'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { JENIS_PEKERJA } from '@/lib/absensi/tipe';
import { validTgl } from '@/lib/tanggal';

const uang = z.preprocess((v) => Number(String(v ?? '').replace(/\D/g, '') || 0), z.number().int().min(0).max(1_000_000_000_000));
const teksOpsional = (maks: number) => z.preprocess((v) => (String(v ?? '').trim() || null), z.string().max(maks).nullable());
const tanggal = z.preprocess((v) => (String(v ?? '') || null), z.string().refine(validTgl, 'Tanggal tidak valid').nullable());

const Skema = z.object({
  pin: z.string().trim().min(1, 'PIN wajib diisi').max(20),
  nama: z.string().trim().min(1, 'Nama wajib diisi').max(150),
  departemenId: z.preprocess((v) => (v ? Number(v) : null), z.number().int().nullable()),
  departemenBaru: teksOpsional(100),
  jabatan: teksOpsional(100),
  shiftId: z.preprocess((v) => (v ? Number(v) : null), z.number().int().nullable()),
  hariLiburMingguan: z.array(z.coerce.number().int().min(0).max(6)),
  tanggalMasuk: tanggal,
  tanggalKeluar: tanggal,
  aktif: z.boolean(),
  jenisPekerja: z.enum(JENIS_PEKERJA),
  gajiPokok: uang,
  upahHarian: uang,
  tarifLemburPerJam: uang,
  uangMakan: uang,
  uangMakanPerHari: z.boolean(),
  tunjanganPrestasi: uang,
  premiHadir: uang,
  jatahLibur: z.coerce.number().int().min(0, 'Minimal 0').max(31, 'Maksimal 31'),
  catatan: teksOpsional(2000),
}).refine((d) => !d.tanggalMasuk || !d.tanggalKeluar || d.tanggalKeluar >= d.tanggalMasuk, {
  path: ['tanggalKeluar'], message: 'Tanggal berhenti harus setelah tanggal mulai bekerja',
});

export type StateForm = { pesan?: string; galat?: Record<string, string> } | null;

export async function simpanKaryawan(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  await wajibPengelola();
  const hasil = Skema.safeParse({
    ...Object.fromEntries(form),
    hariLiburMingguan: form.getAll('hariLiburMingguan'),
    aktif: form.get('aktif') === 'on',
    uangMakanPerHari: form.get('uangMakanPerHari') === 'on',
  });
  if (!hasil.success) {
    const galat: Record<string, string> = {};
    for (const i of hasil.error.issues) galat[String(i.path[0])] ??= i.message;
    return { pesan: 'Periksa kembali isian yang ditandai.', galat };
  }
  const { departemenBaru, hariLiburMingguan, ...d } = hasil.data;

  const pinDipakai = await db.$count(schema.karyawan, and(eq(schema.karyawan.pin, d.pin), id ? ne(schema.karyawan.id, id) : undefined));
  if (pinDipakai) return { pesan: 'Periksa kembali isian yang ditandai.', galat: { pin: 'PIN ini sudah dipakai karyawan lain.' } };

  if (departemenBaru) {
    const [dep] = await db.insert(schema.departemen).values({ nama: departemenBaru })
      .onConflictDoUpdate({ target: schema.departemen.nama, set: { nama: departemenBaru } }).returning({ id: schema.departemen.id });
    d.departemenId = dep.id;
  }
  // Karyawan bulanan tidak punya libur rutin; Harian tidak mendapat premi hadir
  const nilai = {
    ...d,
    hariLiburMingguan: d.jenisPekerja === 'Bulanan' || !hariLiburMingguan.length ? null : hariLiburMingguan,
    premiHadir: d.jenisPekerja === 'Harian' ? 0 : d.premiHadir,
    updatedAt: new Date().toISOString(),
  };
  if (id) await db.update(schema.karyawan).set(nilai).where(eq(schema.karyawan.id, id));
  else [{ id }] = await db.insert(schema.karyawan).values(nilai).returning({ id: schema.karyawan.id });

  revalidatePath('/', 'layout');
  redirect(`/karyawan/${id}`);
}

export async function ubahAktif(id: number, aktif: boolean) {
  await wajibPengelola();
  await db.update(schema.karyawan).set({ aktif, updatedAt: new Date().toISOString() }).where(eq(schema.karyawan.id, id));
  revalidatePath('/', 'layout');
}
