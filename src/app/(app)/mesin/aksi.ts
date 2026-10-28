'use server';

import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, schema } from '@/db';
import { wajibAdmin, wajibPengelola } from '@/lib/auth/sesi';
import { enkripsi } from '@/lib/enkripsi';
import { MesinError } from '@/lib/fingerspot/klien';
import { klienUntuk, sinkronMesin } from '@/lib/fingerspot/sinkron';

export type Hasil = { ok: boolean; pesan: string } | null;

const Skema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(100),
  cloudId: z.string().trim().min(1, 'Cloud ID wajib diisi').max(50),
  apiToken: z.string().trim().max(500),
});

export async function simpanMesin(id: number | null, _: Hasil, form: FormData): Promise<Hasil> {
  await wajibAdmin();
  const d = Skema.safeParse(Object.fromEntries(form));
  if (!d.success) return { ok: false, pesan: d.error.issues[0].message };
  if (!id && !d.data.apiToken) return { ok: false, pesan: 'API token wajib diisi.' };
  const nilai = {
    nama: d.data.nama, cloudId: d.data.cloudId, aktif: form.get('aktif') === 'on',
    ...(d.data.apiToken ? { apiToken: enkripsi(d.data.apiToken) } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (id) await db.update(schema.mesin).set(nilai).where(eq(schema.mesin.id, id));
  else await db.insert(schema.mesin).values({ ...nilai, webhookToken: randomBytes(24).toString('base64url') });
  revalidatePath('/mesin');
  return { ok: true, pesan: 'Pengaturan mesin disimpan.' };
}

async function ambil(id: number) {
  const [m] = await db.select().from(schema.mesin).where(eq(schema.mesin.id, id));
  if (!m) throw new MesinError('Mesin tidak ditemukan.');
  return m;
}

async function jalankan(kerja: () => Promise<string>): Promise<Hasil> {
  await wajibPengelola();
  try {
    const pesan = await kerja();
    revalidatePath('/', 'layout');
    return { ok: true, pesan };
  } catch (e) {
    return { ok: false, pesan: e instanceof MesinError ? e.message : `Gagal: ${(e as Error).message}` };
  }
}

export async function sinkronSekarang(id: number): Promise<Hasil> {
  return jalankan(async () => {
    const r = await sinkronMesin(await ambil(id), true);
    if (!r.berhasil) throw new MesinError(r.pesan);
    return r.pesan;
  });
}

export async function cekKoneksi(id: number): Promise<Hasil> {
  return jalankan(async () => {
    const info = await klienUntuk(await ambil(id)).infoMesin();
    return `Terhubung: ${info.device_name ?? 'mesin'}${info.last_activity ? `, aktivitas terakhir ${info.last_activity}` : ''}.`;
  });
}

export async function aturJam(id: number): Promise<Hasil> {
  return jalankan(async () => {
    await klienUntuk(await ambil(id)).aturJam();
    return 'Perintah atur jam dikirim. Jam mesin akan mengikuti jam server Fingerspot.io (WIB).';
  });
}

export async function tarikUser(id: number): Promise<Hasil> {
  return jalankan(async () => {
    await klienUntuk(await ambil(id)).mintaDaftarUser();
    return 'Permintaan daftar user dikirim. Karyawan baru masuk otomatis lewat webhook dalam beberapa detik.';
  });
}
