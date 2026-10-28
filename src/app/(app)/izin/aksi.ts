'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { IZIN_TANPA_JATAH, JENIS_IZIN } from '@/lib/absensi/tipe';
import { angkaAtauNull, centang, sekarangIso, tanggalAtauNull, teksAtauNull, teks, type StateForm } from '@/lib/formulir';

export async function simpanIzin(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  const u = await wajibPengelola();
  const karyawanId = angkaAtauNull(form.get('karyawanId'));
  const jenis = teks(form.get('jenis'));
  const tanggalMulai = tanggalAtauNull(form.get('tanggalMulai'));
  const tanggalSelesai = tanggalAtauNull(form.get('tanggalSelesai'));
  const keterangan = teksAtauNull(form.get('keterangan'));
  const galat: Record<string, string> = {};
  if (!karyawanId) galat.karyawanId = 'Pilih karyawan.';
  if (!(jenis in JENIS_IZIN)) galat.jenis = 'Pilih jenis.';
  if (!tanggalMulai) galat.tanggalMulai = 'Tanggal mulai wajib diisi.';
  if (!tanggalSelesai) galat.tanggalSelesai = 'Tanggal selesai wajib diisi.';
  else if (tanggalMulai && tanggalSelesai < tanggalMulai) galat.tanggalSelesai = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  if (keterangan && keterangan.length > 255) galat.keterangan = 'Maksimal 255 karakter.';
  if (Object.keys(galat).length) return { galat };
  const nilai = {
    karyawanId: karyawanId!, jenis, tanggalMulai: tanggalMulai!, tanggalSelesai: tanggalSelesai!, keterangan,
    // cuti & dinas luar tidak pernah mengurangi jatah libur
    kurangiJatah: !IZIN_TANPA_JATAH.includes(jenis) && centang(form.get('kurangiJatah')),
    updatedAt: sekarangIso(),
  };
  if (id) await db.update(schema.izin).set(nilai).where(eq(schema.izin.id, id));
  else await db.insert(schema.izin).values({ ...nilai, dibuatOleh: u.id });
  revalidatePath('/', 'layout');
  redirect(form.get('kembali') === 'karyawan' ? `/karyawan/${karyawanId}` : '/izin');
}

export async function hapusIzin(id: number) {
  await wajibPengelola();
  await db.delete(schema.izin).where(eq(schema.izin.id, id));
  revalidatePath('/', 'layout');
}
