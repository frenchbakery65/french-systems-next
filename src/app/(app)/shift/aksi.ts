'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { centang, jamAtauNull, sekarangIso, teks, type StateForm } from '@/lib/formulir';
import { WARNA_SHIFT } from '@/lib/shift';
import { keMenit } from '@/lib/tanggal';

export async function simpanShift(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  await wajibPengelola();
  const kode = teks(form.get('kode')).toUpperCase();
  const nama = teks(form.get('nama'));
  const jamMasuk = jamAtauNull(form.get('jamMasuk'));
  const jamPulang = jamAtauNull(form.get('jamPulang'));
  const toleransi = Number(teks(form.get('toleransiTelatMenit')));
  const warna = teks(form.get('warna'));
  const galat: Record<string, string> = {};
  if (!kode || kode.length > 20) galat.kode = 'Kode wajib diisi (maks. 20 karakter).';
  if (!nama || nama.length > 100) galat.nama = 'Nama wajib diisi.';
  if (!jamMasuk) galat.jamMasuk = 'Jam masuk wajib diisi.';
  if (!jamPulang) galat.jamPulang = 'Jam pulang wajib diisi.';
  else if (jamMasuk && keMenit(jamPulang) <= keMenit(jamMasuk)) galat.jamPulang = 'Jam pulang harus setelah jam masuk. Shift lewat tengah malam tidak didukung.';
  if (!Number.isInteger(toleransi) || toleransi < 0 || toleransi > 120) galat.toleransiTelatMenit = 'Toleransi 0–120 menit.';
  if (kode && await db.$count(schema.shift, and(eq(schema.shift.kode, kode), id ? ne(schema.shift.id, id) : undefined))) galat.kode = 'Kode sudah dipakai shift lain.';
  if (Object.keys(galat).length) return { galat };
  const nilai = {
    kode, nama, jamMasuk: jamMasuk!, jamPulang: jamPulang!, toleransiTelatMenit: toleransi,
    warna: warna in WARNA_SHIFT ? warna : 'gray', aktif: centang(form.get('aktif')), updatedAt: sekarangIso(),
  };
  if (id) await db.update(schema.shift).set(nilai).where(eq(schema.shift.id, id));
  else await db.insert(schema.shift).values(nilai);
  revalidatePath('/', 'layout');
  redirect('/shift');
}

/** Shift masih dipakai karyawan atau jadwal khusus → tidak bisa dihapus, hanya dinonaktifkan. */
async function shiftDipakai(id: number) {
  const [r] = await db.select({ n: sql<number>`(select count(*) from karyawan where shift_id = ${id}) + (select count(*) from jadwal_karyawan where shift_id = ${id})` }).from(sql`(select 1) x`);
  return Number(r.n) > 0;
}

export async function hapusShift(id: number) {
  await wajibPengelola();
  if (await shiftDipakai(id)) {
    await db.update(schema.shift).set({ aktif: false, updatedAt: sekarangIso() }).where(eq(schema.shift.id, id));
  } else {
    await db.delete(schema.shift).where(eq(schema.shift.id, id));
  }
  revalidatePath('/', 'layout');
}

