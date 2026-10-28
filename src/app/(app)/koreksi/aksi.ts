'use server';

import { and, asc, eq, gte, lt, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { wajibLogin, wajibPengelola } from '@/lib/auth/sesi';
import { cekTanggalTerkunci } from '@/lib/gaji/periode-db';
import { angkaAtauNull, jamAtauNull, sekarangIso, tanggalAtauNull, teks, type StateForm } from '@/lib/formulir';
import { STATUS_SCAN } from '@/lib/log';
import { keMenit, tambahHari, validTgl } from '@/lib/tanggal';

export async function simpanKoreksi(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  const u = await wajibPengelola();
  const karyawanId = angkaAtauNull(form.get('karyawanId'));
  const tanggal = tanggalAtauNull(form.get('tanggal'));
  const jamMasuk = jamAtauNull(form.get('jamMasuk'));
  const jamPulang = jamAtauNull(form.get('jamPulang'));
  const alasan = teks(form.get('alasan'));
  const galat: Record<string, string> = {};
  if (!karyawanId) galat.karyawanId = 'Pilih karyawan.';
  if (!tanggal) galat.tanggal = 'Tanggal wajib diisi.';
  if (!jamMasuk && !jamPulang) galat.jamMasuk = 'Isi minimal jam masuk atau jam pulang.';
  if (jamMasuk && jamPulang && keMenit(jamPulang) <= keMenit(jamMasuk)) galat.jamPulang = 'Jam pulang harus setelah jam masuk.';
  if (!alasan || alasan.length > 255) galat.alasan = 'Alasan wajib diisi (maks. 255 karakter).';
  if (karyawanId && tanggal && await db.$count(schema.koreksiAbsen, and(
    eq(schema.koreksiAbsen.karyawanId, karyawanId), eq(schema.koreksiAbsen.tanggal, tanggal), id ? ne(schema.koreksiAbsen.id, id) : undefined,
  ))) galat.tanggal = 'Sudah ada koreksi untuk karyawan ini pada tanggal tersebut. Ubah koreksi yang sudah ada.';
  if (Object.keys(galat).length) return { galat };
  const lama = id ? (await db.select().from(schema.koreksiAbsen).where(eq(schema.koreksiAbsen.id, id)))[0] : undefined;
  const terkunci = await cekTanggalTerkunci(tanggal!) ?? (lama ? await cekTanggalTerkunci(lama.tanggal) : null);
  if (terkunci) return { pesan: terkunci };
  const nilai = { karyawanId: karyawanId!, tanggal: tanggal!, jamMasuk, jamPulang, alasan, updatedAt: sekarangIso() };
  if (id) await db.update(schema.koreksiAbsen).set(nilai).where(eq(schema.koreksiAbsen.id, id));
  else await db.insert(schema.koreksiAbsen).values({ ...nilai, dibuatOleh: u.id });
  revalidatePath('/', 'layout');
  redirect(form.get('kembali') === 'karyawan' ? `/karyawan/${karyawanId}` : '/koreksi');
}

export async function hapusKoreksi(id: number): Promise<string | void> {
  await wajibPengelola();
  const [kor] = await db.select().from(schema.koreksiAbsen).where(eq(schema.koreksiAbsen.id, id));
  if (!kor) return;
  const terkunci = await cekTanggalTerkunci(kor.tanggal);
  if (terkunci) return terkunci;
  await db.delete(schema.koreksiAbsen).where(eq(schema.koreksiAbsen.id, id));
  revalidatePath('/', 'layout');
}

/** Scan asli dari mesin untuk karyawan & tanggal (ditampilkan di formulir koreksi). */
export async function scanAsli(karyawanId: number, tanggal: string): Promise<string> {
  await wajibLogin();
  if (!karyawanId || !validTgl(tanggal)) return 'Pilih karyawan dan tanggal untuk melihat scan asli.';
  const [k] = await db.select({ pin: schema.karyawan.pin }).from(schema.karyawan).where(eq(schema.karyawan.id, karyawanId));
  if (!k) return 'Karyawan tidak ditemukan.';
  const log = await db.select({ waktu: schema.logAbsen.waktuScan, status: schema.logAbsen.statusScan }).from(schema.logAbsen)
    .where(and(eq(schema.logAbsen.pin, k.pin), gte(schema.logAbsen.waktuScan, `${tanggal} 00:00:00`), lt(schema.logAbsen.waktuScan, `${tambahHari(tanggal, 1)} 00:00:00`)))
    .orderBy(asc(schema.logAbsen.waktuScan));
  return log.length
    ? log.map((l) => `${l.waktu.slice(11, 19)} (${l.status === null ? '-' : STATUS_SCAN[l.status] ?? `Kode ${l.status}`})`).join(', ')
    : 'Tidak ada scan dari mesin pada tanggal ini.';
}
