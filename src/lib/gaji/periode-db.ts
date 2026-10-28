/** Hitung & simpan slip gaji satu periode (port dari HitungGaji::periode / segarkan / ubahManual). */
import 'server-only';
import { and, eq, getTableColumns, gte, inArray, lte, ne, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { PeriodeGaji } from '@/db/schema';
import { muatPerhitungan } from '../absensi/muat';
import { jadwalUmum, pengaturanGaji } from '../pengaturan';
import type { Tgl } from '../tanggal';
import { hitungSlip, hitungTotal, MANUAL_KOSONG, type KaryawanGaji, type Manual, type Slip } from './hitung';

export class PeriodeFinal extends Error {
  constructor() { super('Periode sudah dikunci (final). Buka kunci dulu untuk menghitung ulang.'); }
}

const ambilManual = (s: Manual): Manual => ({
  komisi: s.komisi, bonus: s.bonus, potKasbon: s.potKasbon, potPinjaman: s.potPinjaman, potLain: s.potLain, pot5: s.pot5,
  jamLemburManual: s.jamLemburManual, catatan: s.catatan,
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Kunci baris periode selama transaksi, supaya hitung ulang, ubah slip manual, dan mengunci periode
 * tidak saling menimpa (mis. webhook menghitung ulang saat HRD sedang mengisi kasbon).
 * `lewati`: jika periode sedang dikunci proses lain, kembalikan null alih-alih menunggu.
 */
async function kunciBaris(tx: Tx, id: number, lewati = false) {
  const [p] = await tx.select().from(schema.periodeGaji).where(eq(schema.periodeGaji.id, id))
    .for('update', lewati ? { skipLocked: true } : undefined);
  if (!p && !lewati) throw new Error('Periode tidak ditemukan.');
  if (p?.status === 'final') throw new PeriodeFinal();
  return p ?? null;
}

export interface OpsiHitung {
  /** Lewati (kembalikan 0) jika periode sedang dihitung proses lain; dipakai hitung ulang otomatis di latar. */
  lewatiJikaSibuk?: boolean;
  /** Kunci periode (final) oleh user ini setelah dihitung, dalam transaksi yang sama. */
  kunciOleh?: number;
}

/** Hitung ulang semua slip periode draf dari absensi. Isian manual HRD tidak ditimpa. Mengembalikan jumlah slip. */
export async function hitungPeriode(awal: PeriodeGaji, opsi: OpsiHitung = {}): Promise<number> {
  if (awal.status === 'final') throw new PeriodeFinal();
  return db.transaction(async (tx) => {
    const p = await kunciBaris(tx, awal.id, opsi.lewatiJikaSibuk);
    if (!p) return 0;
    return hitungDalamTransaksi(tx, p, opsi.kunciOleh);
  });
}

async function hitungDalamTransaksi(tx: Tx, p: PeriodeGaji, kunciOleh?: number): Promise<number> {
  // Absensi dibaca setelah periode dikunci, supaya log yang masuk sebelumnya pasti ikut terhitung.
  const [aturan, jadwal] = await Promise.all([pengaturanGaji(), jadwalUmum()]);
  const hitung = await muatPerhitungan(p.tanggalMulai, p.tanggalSelesai, { satuPeriode: true, masukSampai: p.tanggalSelesai });
  const rekap = hitung.rekap();
  const ids = rekap.map((r) => r.karyawan.id);
  const [penuh, ada] = await Promise.all([
    ids.length ? tx.select().from(schema.karyawan).where(inArray(schema.karyawan.id, ids)) : [],
    tx.select().from(schema.slipGaji).where(eq(schema.slipGaji.periodeGajiId, p.id)),
  ]);
  const perId = new Map(penuh.map((k) => [k.id, k]));
  const manual = new Map(ada.map((s) => [s.karyawanId, ambilManual(s)]));
  const konteks = { mulai: p.tanggalMulai, selesai: p.tanggalSelesai, aturan, jadwal, libur: hitung.data.libur };

  const baris = rekap.map((r) => {
    const k = perId.get(r.karyawan.id)!;
    const kg: KaryawanGaji = { ...r.karyawan, jabatan: k.jabatan, tarifLemburPerJam: k.tarifLemburPerJam, uangMakan: k.uangMakan,
      uangMakanPerHari: k.uangMakanPerHari, tunjanganPrestasi: k.tunjanganPrestasi, premiHadir: k.premiHadir };
    return { ...hitungSlip(kg, r, konteks, manual.get(k.id) ?? MANUAL_KOSONG), periodeGajiId: p.id, karyawanId: k.id, updatedAt: new Date().toISOString() };
  });

  const kolom = getTableColumns(schema.slipGaji);
  const diperbarui = Object.fromEntries(
    Object.keys(baris[0] ?? {}).filter((c) => c !== 'periodeGajiId' && c !== 'karyawanId')
      .map((c) => [c, sql.raw(`excluded."${kolom[c as keyof typeof kolom].name}"`)]),
  );
  if (baris.length) {
    await tx.insert(schema.slipGaji).values(baris)
      .onConflictDoUpdate({ target: [schema.slipGaji.periodeGajiId, schema.slipGaji.karyawanId], set: diperbarui });
  }
  // karyawan yang sudah tidak termasuk periode ini dikeluarkan dari daftar
  await tx.delete(schema.slipGaji).where(and(eq(schema.slipGaji.periodeGajiId, p.id), ids.length ? notInArray(schema.slipGaji.karyawanId, ids) : undefined));
  const kini = new Date();
  await tx.update(schema.periodeGaji)
    .set({ dihitungPada: kini, ...(kunciOleh ? { status: 'final', dikunciOleh: kunciOleh, dikunciPada: kini } : {}) })
    .where(eq(schema.periodeGaji.id, p.id));
  return baris.length;
}

/** Hitung ulang slip periode draf supaya akumulasi telat, lembur, dan potongan selalu terbaru. Periode final tidak disentuh. */
export async function segarkan(p: PeriodeGaji) {
  if (p.status !== 'final') await hitungPeriode(p);
}

/** Segarkan semua periode draf yang mencakup rentang tanggal (dipakai saat ada log baru). */
export async function segarkanRentang(dari: Tgl, sampai: Tgl): Promise<number> {
  const daftar = await db.select().from(schema.periodeGaji)
    .where(and(ne(schema.periodeGaji.status, 'final'), lte(schema.periodeGaji.tanggalMulai, sampai), gte(schema.periodeGaji.tanggalSelesai, dari)));
  for (const p of daftar) await hitungPeriode(p, { lewatiJikaSibuk: true });
  return daftar.length;
}

/** Segarkan setelah ada log baru; gagal hitung gaji tidak boleh menggagalkan penyimpanan log. */
export async function segarkanSetelahLog(waktu: string[]) {
  if (!waktu.length) return;
  const tgl = waktu.map((w) => w.slice(0, 10)).sort();
  try {
    await segarkanRentang(tgl[0], tgl[tgl.length - 1]);
  } catch (e) {
    console.error('Gagal menyegarkan slip gaji:', e);
  }
}

/** Simpan perubahan manual pada satu slip lalu hitung ulang totalnya. */
export async function ubahManual(slipId: number, data: Partial<Manual>) {
  return db.transaction(async (tx) => {
    const [ref] = await tx.select({ periodeId: schema.slipGaji.periodeGajiId }).from(schema.slipGaji).where(eq(schema.slipGaji.id, slipId));
    if (!ref) throw new Error('Slip tidak ditemukan.');
    await kunciBaris(tx, ref.periodeId); // tunggu hitung ulang yang sedang berjalan, tolak jika sudah final
    const [s] = await tx.select().from(schema.slipGaji).where(eq(schema.slipGaji.id, slipId));
    if (!s) throw new Error('Slip tidak ditemukan.');
    const baru = hitungTotal({ ...(s as unknown as Slip), ...data });
    await tx.update(schema.slipGaji).set({
      ...ambilManual(baru), upahLembur: baru.upahLembur, subtotalGaji: baru.subtotalGaji, totalPenerimaan: baru.totalPenerimaan,
      totalKotor: baru.totalKotor, totalPotongan: baru.totalPotongan, gajiBersih: baru.gajiBersih, updatedAt: new Date().toISOString(),
    }).where(eq(schema.slipGaji.id, slipId));
    return baru;
  });
}

/** Periode final yang mencakup salah satu tanggal dalam [dari, sampai], jika ada. */
export async function periodeFinalUntuk(dari: Tgl, sampai: Tgl = dari) {
  const [p] = await db.select().from(schema.periodeGaji).where(and(
    eq(schema.periodeGaji.status, 'final'), lte(schema.periodeGaji.tanggalMulai, sampai), gte(schema.periodeGaji.tanggalSelesai, dari),
  )).limit(1);
  return p ?? null;
}

/** Pesan galat jika tanggal masuk periode gaji yang sudah dikunci; null jika boleh diubah. */
export async function cekTanggalTerkunci(dari: Tgl, sampai: Tgl = dari): Promise<string | null> {
  const p = await periodeFinalUntuk(dari, sampai);
  return p ? `Tanggal ini masuk periode gaji "${p.nama}" yang sudah dikunci (final). Minta admin membuka kunci periode itu dulu.` : null;
}
