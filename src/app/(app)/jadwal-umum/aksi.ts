'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { centang, jamAtauNull, sekarangIso, teks, type StateForm } from '@/lib/formulir';
import { jadwalUmum } from '@/lib/pengaturan';
import { keMenit } from '@/lib/tanggal';

const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'] as const;

export async function simpanJadwalUmum(_: StateForm, form: FormData): Promise<StateForm> {
  await wajibPengelola();
  const jamMasuk = jamAtauNull(form.get('jamMasuk'));
  const jamPulang = jamAtauNull(form.get('jamPulang'));
  const toleransi = Number(teks(form.get('toleransiTelatMenit')));
  const jarak = Number(teks(form.get('jarakMinimalPulangMenit')));
  const galat: Record<string, string> = {};
  if (!jamMasuk) galat.jamMasuk = 'Jam masuk wajib diisi.';
  if (!jamPulang) galat.jamPulang = 'Jam pulang wajib diisi.';
  else if (jamMasuk && keMenit(jamPulang) <= keMenit(jamMasuk)) galat.jamPulang = 'Jam pulang harus setelah jam masuk (jadwal ini tidak mendukung shift malam).';
  if (!Number.isInteger(toleransi) || toleransi < 0 || toleransi > 240) galat.toleransiTelatMenit = 'Toleransi 0–240 menit.';
  if (!Number.isInteger(jarak) || jarak < 1 || jarak > 720) galat.jarakMinimalPulangMenit = 'Isi 1–720 menit.';
  if (Object.keys(galat).length) return { galat };
  const j = await jadwalUmum();
  await db.update(schema.jadwalKerja).set({
    jamMasuk: jamMasuk!, jamPulang: jamPulang!, toleransiTelatMenit: toleransi, jarakMinimalPulangMenit: jarak,
    ...Object.fromEntries(HARI.map((h) => [h, centang(form.get(h))])), updatedAt: sekarangIso(),
  }).where(eq(schema.jadwalKerja.id, j.id));
  revalidatePath('/', 'layout');
  return { ok: true, pesan: 'Jadwal kerja disimpan.' };
}
