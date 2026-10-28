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

/** Hitung ulang semua slip periode draf dari absensi. Isian manual HRD tidak ditimpa. Mengembalikan jumlah slip. */
export async function hitungPeriode(p: PeriodeGaji): Promise<number> {
  if (p.status === 'final') throw new PeriodeFinal();
  const [aturan, jadwal] = await Promise.all([pengaturanGaji(), jadwalUmum()]);
  const hitung = await muatPerhitungan(p.tanggalMulai, p.tanggalSelesai, { satuPeriode: true, masukSampai: p.tanggalSelesai });
  const rekap = hitung.rekap();
  const ids = rekap.map((r) => r.karyawan.id);
  const [penuh, ada] = await Promise.all([
    ids.length ? db.select().from(schema.karyawan).where(inArray(schema.karyawan.id, ids)) : [],
    db.select().from(schema.slipGaji).where(eq(schema.slipGaji.periodeGajiId, p.id)),
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
  await db.transaction(async (tx) => {
    if (baris.length) {
      await tx.insert(schema.slipGaji).values(baris)
        .onConflictDoUpdate({ target: [schema.slipGaji.periodeGajiId, schema.slipGaji.karyawanId], set: diperbarui });
    }
    // karyawan yang sudah tidak termasuk periode ini dikeluarkan dari daftar
    await tx.delete(schema.slipGaji).where(and(eq(schema.slipGaji.periodeGajiId, p.id), ids.length ? notInArray(schema.slipGaji.karyawanId, ids) : undefined));
    await tx.update(schema.periodeGaji).set({ dihitungPada: new Date() }).where(eq(schema.periodeGaji.id, p.id));
  });
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
  for (const p of daftar) await hitungPeriode(p);
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
  const [baris] = await db.select({ s: schema.slipGaji, status: schema.periodeGaji.status }).from(schema.slipGaji)
    .innerJoin(schema.periodeGaji, eq(schema.periodeGaji.id, schema.slipGaji.periodeGajiId)).where(eq(schema.slipGaji.id, slipId));
  if (!baris) throw new Error('Slip tidak ditemukan.');
  if (baris.status === 'final') throw new PeriodeFinal();
  const baru = hitungTotal({ ...(baris.s as unknown as Slip), ...data });
  await db.update(schema.slipGaji).set({
    ...ambilManual(baru), upahLembur: baru.upahLembur, subtotalGaji: baru.subtotalGaji, totalPenerimaan: baru.totalPenerimaan,
    totalKotor: baru.totalKotor, totalPotongan: baru.totalPotongan, gajiBersih: baru.gajiBersih, updatedAt: new Date().toISOString(),
  }).where(eq(schema.slipGaji.id, slipId));
  return baru;
}
