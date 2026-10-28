/** Menarik log dari mesin (lewat Fingerspot.io) dan menyimpannya ke database tanpa duplikat. */
import 'server-only';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Mesin } from '@/db/schema';
import { dekripsi } from '../enkripsi';
import { segarkanSetelahLog } from '../gaji/periode-db';
import { sekarang, tambahHari } from '../tanggal';
import { KlienFingerspot, MAKS_HARI, MesinError, type BarisLog } from './klien';

/** Awalan nama karyawan yang dibuat otomatis dari scan; diganti nama asli begitu data user dari mesin masuk. */
export const NAMA_SEMENTARA = 'Karyawan PIN ';

export function klienUntuk(m: Mesin): KlienFingerspot {
  if (!m.cloudId?.trim()) throw new MesinError('Cloud ID mesin belum diisi. Buka menu Mesin lalu isi Cloud ID.');
  if (!m.apiToken) throw new MesinError('API token Fingerspot.io belum diisi. Buka menu Mesin lalu isi API token.');
  return new KlienFingerspot(m.cloudId.trim(), dekripsi(m.apiToken).trim());
}

/**
 * Simpan log (unik per PIN + waktu scan). Mengembalikan jumlah baris baru.
 * Ada log baru → slip periode draf dihitung ulang supaya telat & lembur terakumulasi.
 */
export async function simpanLog(baris: BarisLog[], mesinId: number | null = null, sumber = 'mesin'): Promise<number> {
  const waktuBaru: string[] = [];
  for (let i = 0; i < baris.length; i += 500) {
    const hasil = await db.insert(schema.logAbsen)
      .values(baris.slice(i, i + 500).map((b) => ({ mesinId, pin: b.pin.trim(), waktuScan: b.waktu, verifikasi: b.verifikasi, statusScan: b.status, sumber })))
      .onConflictDoNothing({ target: [schema.logAbsen.pin, schema.logAbsen.waktuScan] })
      .returning({ waktu: schema.logAbsen.waktuScan });
    waktuBaru.push(...hasil.map((h) => h.waktu));
  }
  await segarkanSetelahLog(waktuBaru);
  return waktuBaru.length;
}

async function catatRiwayat(mesinId: number, pesan: string) {
  const kini = new Date();
  await db.insert(schema.riwayatSinkron).values({ mesinId, mulai: kini, selesai: kini, berhasil: true, pesan });
}

/** Tanggal scan pertama per PIN, dipakai sebagai tanggal mulai bekerja karyawan yang didaftarkan otomatis. */
export function scanPertama(baris: Pick<BarisLog, 'pin' | 'waktu'>[]): Map<string, string> {
  const hasil = new Map<string, string>();
  for (const b of baris) {
    const pin = b.pin.trim();
    const tgl = b.waktu.slice(0, 10);
    if (pin && (!hasil.has(pin) || tgl < hasil.get(pin)!)) hasil.set(pin, tgl);
  }
  return hasil;
}

/**
 * PIN yang scan di mesin tapi belum ada di dashboard langsung didaftarkan sebagai karyawan
 * (nama sementara "Karyawan PIN x"), supaya scannya ikut terhitung di rekap. Nama asli diminta
 * ke mesin; jawabannya datang lewat webhook. Tanggal mulai bekerja = tanggal scan pertama, supaya
 * hari sebelum itu tidak dihitung sebagai libur/tidak hadir.
 */
export async function daftarkanPinBaru(m: Mesin, baris: BarisLog[]): Promise<string[]> {
  const pertama = scanPertama(baris);
  const unik = [...pertama.keys()];
  if (!unik.length) return [];
  const ada = new Set((await db.select({ pin: schema.karyawan.pin }).from(schema.karyawan).where(inArray(schema.karyawan.pin, unik))).map((x) => x.pin));
  const baru = unik.filter((p) => !ada.has(p));
  if (!baru.length) return [];
  await db.insert(schema.karyawan).values(baru.map((pin) => ({ pin, nama: NAMA_SEMENTARA + pin, tanggalMasuk: pertama.get(pin) }))).onConflictDoNothing();
  for (const pin of baru) {
    try {
      await klienUntuk(m).mintaUser(pin);
    } catch {
      // nama asli tidak wajib; karyawan tetap terdaftar
    }
  }
  await catatRiwayat(m.id, `${baru.length} karyawan baru otomatis didaftarkan dari scan: PIN ${baru.join(', ')}. `
    + 'Lengkapi nama & data lain di menu Karyawan (nama terisi otomatis jika webhook dipasang).');
  return baru;
}

/**
 * Daftarkan PIN sebagai karyawan, atau isi namanya jika masih bernama sementara.
 * Nama yang sudah diisi orang tidak pernah ditimpa.
 */
export async function isiKaryawan(pin: string, nama: string, tanggalMasuk: string | null = null): Promise<'baru' | 'diisi' | null> {
  pin = pin.trim();
  nama = nama.trim();
  if (!pin) return null;
  const dibuat = await db.insert(schema.karyawan).values({ pin, nama: nama || NAMA_SEMENTARA + pin, tanggalMasuk }).onConflictDoNothing().returning({ id: schema.karyawan.id });
  if (dibuat.length) return 'baru';
  if (!nama) return null;
  const diisi = await db.update(schema.karyawan).set({ nama, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.karyawan.pin, pin), eq(schema.karyawan.nama, NAMA_SEMENTARA + pin))).returning({ id: schema.karyawan.id });
  return diisi.length ? 'diisi' : null;
}

/** Data user dari mesin (webhook get_userinfo). */
export async function terimaUser(m: Mesin, pin: string, nama: string) {
  const [log] = await db.select({ pertama: sql<string | null>`min(${schema.logAbsen.waktuScan})` }).from(schema.logAbsen)
    .where(eq(schema.logAbsen.pin, pin.trim()));
  const hasil = await isiKaryawan(pin, nama, log?.pertama ? log.pertama.slice(0, 10) : null);
  if (hasil === 'diisi') await catatRiwayat(m.id, `Nama karyawan PIN ${pin.trim()} diisi dari mesin: ${nama.trim()}.`);
  if (hasil === 'baru') await catatRiwayat(m.id, `Karyawan baru dari mesin: ${nama.trim() || NAMA_SEMENTARA + pin.trim()} (PIN ${pin.trim()}).`);
  return hasil;
}

/**
 * Tarik log dari satu mesin: sejak sehari sebelum sinkron berhasil terakhir sampai hari ini
 * (pertama kali: 59 hari ke belakang, batas simpan Fingerspot.io). Riwayat hanya dicatat jika ada data baru,
 * gagal, atau status berubah, supaya riwayat tidak penuh oleh sinkron rutin.
 */
export async function sinkronMesin(m: Mesin, catatSelalu = false) {
  const mulai = new Date();
  const hariIni = sekarang().tanggal;
  const r = { berhasil: false, jumlahDiterima: 0, jumlahBaru: 0, pesan: '' };
  const ubah: Partial<typeof schema.mesin.$inferInsert> = {};
  try {
    const dari = m.sinkronBerhasilTerakhir ? tambahHari(sekarang(m.sinkronBerhasilTerakhir).tanggal, -1) : tambahHari(hariIni, -MAKS_HARI);
    const baris = await klienUntuk(m).ambilLog(dari, hariIni);
    r.jumlahBaru = await simpanLog(baris, m.id);
    await daftarkanPinBaru(m, baris);
    r.berhasil = true;
    r.jumlahDiterima = baris.length;
    r.pesan = `${baris.length} log dibaca dari Fingerspot.io (${dari.slice(8, 10)}/${dari.slice(5, 7)}–${hariIni.slice(8, 10)}/${hariIni.slice(5, 7)}), ${r.jumlahBaru} log baru disimpan.`;
    Object.assign(ubah, { statusTerakhir: 'ok', sinkronBerhasilTerakhir: mulai, jumlahLogDiMesin: baris.length });
  } catch (e) {
    r.pesan = e instanceof MesinError ? e.message : `Error tak terduga: ${(e as Error).message}`;
    if (!(e instanceof MesinError)) console.error(e);
    ubah.statusTerakhir = 'gagal';
  }
  await db.update(schema.mesin).set({ ...ubah, pesanTerakhir: r.pesan, sinkronTerakhir: mulai }).where(eq(schema.mesin.id, m.id));
  const [terakhir] = await db.select().from(schema.riwayatSinkron).where(eq(schema.riwayatSinkron.mesinId, m.id))
    .orderBy(desc(schema.riwayatSinkron.mulai), desc(schema.riwayatSinkron.id)).limit(1);
  if (catatSelalu || r.jumlahBaru || !terakhir || terakhir.berhasil !== r.berhasil || (!r.berhasil && terakhir.pesan !== r.pesan)) {
    await db.insert(schema.riwayatSinkron).values({ mesinId: m.id, mulai, selesai: new Date(), ...r });
  }
  return r;
}

export async function sinkronSemua() {
  const daftar = await db.select().from(schema.mesin).where(eq(schema.mesin.aktif, true));
  return Promise.all(daftar.map((m) => sinkronMesin(m)));
}

/** Hapus riwayat sinkron lebih dari N hari (hanya catatan teknis, bukan data absen). */
export async function bersihkanRiwayat(hari = 30) {
  await db.delete(schema.riwayatSinkron).where(lt(schema.riwayatSinkron.mulai, new Date(Date.now() - hari * 86_400_000)));
}

/** Dianggap bermasalah jika tidak ada sinkron berhasil dalam 3 menit terakhir (atau 26 jam di paket Hobby). */
export function mesinBermasalah(m: Pick<Mesin, 'sinkronBerhasilTerakhir'>, batasMenit = Number(process.env.BATAS_MESIN_MENIT || 26 * 60)) {
  return !m.sinkronBerhasilTerakhir || Date.now() - m.sinkronBerhasilTerakhir.getTime() > batasMenit * 60_000;
}
