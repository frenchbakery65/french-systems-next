'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db, schema } from '@/db';
import { bisaGaji, wajibPengelola } from '@/lib/auth/sesi';
import { JENIS_PEKERJA } from '@/lib/absensi/tipe';
import { hariIni, validTgl } from '@/lib/tanggal';
import { KOLOM_GAJI } from './gaji';

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
  tunjanganLoyalitas: uang,
  jatahLibur: z.coerce.number().int().min(0, 'Minimal 0').max(31, 'Maksimal 31'),
  catatan: teksOpsional(2000),
}).refine((d) => !d.tanggalMasuk || !d.tanggalKeluar || d.tanggalKeluar >= d.tanggalMasuk, {
  path: ['tanggalKeluar'], message: 'Tanggal berhenti harus setelah tanggal mulai bekerja',
});

export type StateForm = { pesan?: string; galat?: Record<string, string> } | null;

export async function simpanKaryawan(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  const u = await wajibPengelola();
  const masukan: Record<string, unknown> = {
    ...Object.fromEntries(form),
    hariLiburMingguan: form.getAll('hariLiburMingguan'),
    aktif: form.get('aktif') === 'on',
  };
  // Admin absensi tidak boleh mengubah gaji: isian gaji dari form diabaikan, dipakai nilai lama (atau bawaan untuk karyawan baru)
  if (!bisaGaji(u)) {
    const [lama] = id ? await db.select().from(schema.karyawan).where(eq(schema.karyawan.id, id)) : [];
    const bawaan = { jenisPekerja: 'Bulanan', jatahLibur: 2 } as Record<string, unknown>;
    for (const c of KOLOM_GAJI) masukan[c] = lama ? lama[c] : (bawaan[c] ?? 0);
  }
  const hasil = Skema.safeParse(masukan);
  if (!hasil.success) {
    const galat: Record<string, string> = {};
    for (const i of hasil.error.issues) galat[String(i.path[0])] ??= i.message;
    return { pesan: 'Periksa kembali isian yang ditandai.', galat };
  }
  const { departemenBaru, hariLiburMingguan, ...d } = hasil.data;
  const periksa = 'Periksa kembali isian yang ditandai.';

  // Status aktif harus sejalan dengan tanggal berhenti: rekap & gaji memakai tanggal berhenti untuk batas masa kerja.
  // Nonaktif tanpa tanggal berhenti membuat karyawan hilang dari periode gaji berjalan beserta hari kerjanya.
  if (!d.aktif && !d.tanggalKeluar) {
    return { pesan: periksa, galat: { tanggalKeluar: 'Isi tanggal berhenti (hari terakhir bekerja) untuk karyawan yang tidak aktif, supaya gajinya tetap terhitung sampai tanggal itu.' } };
  }
  if (d.aktif && d.tanggalKeluar && d.tanggalKeluar < hariIni()) {
    return { pesan: periksa, galat: { tanggalKeluar: 'Tanggal berhenti sudah lewat, tapi karyawan masih dicentang Aktif. Hilangkan centang Aktif, atau kosongkan tanggal berhenti jika masih bekerja.' } };
  }

  const pinDipakai = await db.$count(schema.karyawan, and(eq(schema.karyawan.pin, d.pin), id ? ne(schema.karyawan.id, id) : undefined));
  if (pinDipakai) return { pesan: periksa, galat: { pin: 'PIN ini sudah dipakai karyawan lain.' } };

  // Scan terhubung ke karyawan lewat PIN: mengganti PIN memutus semua scan lama dari karyawan ini.
  if (id) {
    const [lama] = await db.select({ pin: schema.karyawan.pin }).from(schema.karyawan).where(eq(schema.karyawan.id, id));
    const scanLama = lama && lama.pin !== d.pin ? await db.$count(schema.logAbsen, eq(schema.logAbsen.pin, lama.pin)) : 0;
    if (scanLama && form.get('konfirmasiPin') !== 'on') {
      return {
        pesan: periksa,
        galat: {
          pin: `PIN lama ${lama.pin} punya ${scanLama} scan tercatat. Jika PIN diganti, scan itu tidak lagi terhitung untuk karyawan ini `
            + '(rekap dan gaji periode draf ikut berubah). Ganti hanya jika PIN di mesin memang sudah diganti.',
          konfirmasiPin: 'perlu',
        },
      };
    }
  }

  if (departemenBaru) {
    const [dep] = await db.insert(schema.departemen).values({ nama: departemenBaru })
      .onConflictDoUpdate({ target: schema.departemen.nama, set: { nama: departemenBaru } }).returning({ id: schema.departemen.id });
    d.departemenId = dep.id;
  }
  // Karyawan bulanan tidak punya libur rutin
  const nilai = {
    ...d,
    hariLiburMingguan: d.jenisPekerja === 'Bulanan' || !hariLiburMingguan.length ? null : hariLiburMingguan,
    updatedAt: new Date().toISOString(),
  };
  if (id) await db.update(schema.karyawan).set(nilai).where(eq(schema.karyawan.id, id));
  else [{ id }] = await db.insert(schema.karyawan).values(nilai).returning({ id: schema.karyawan.id });

  revalidatePath('/', 'layout');
  redirect(`/karyawan/${id}`);
}

/**
 * Nonaktifkan: tanggal berhenti diisi hari ini jika masih kosong, supaya hari kerja periode berjalan tetap terhitung.
 * Aktifkan lagi: tanggal berhenti yang sudah lewat dikosongkan, supaya hari berikutnya tidak dianggap di luar masa kerja.
 */
export async function ubahAktif(id: number, aktif: boolean) {
  await wajibPengelola();
  const [k] = await db.select({ tanggalKeluar: schema.karyawan.tanggalKeluar }).from(schema.karyawan).where(eq(schema.karyawan.id, id));
  if (!k) return;
  const kini = hariIni();
  const tanggalKeluar = aktif ? (k.tanggalKeluar && k.tanggalKeluar < kini ? null : k.tanggalKeluar) : (k.tanggalKeluar ?? kini);
  await db.update(schema.karyawan).set({ aktif, tanggalKeluar, updatedAt: new Date().toISOString() }).where(eq(schema.karyawan.id, id));
  revalidatePath('/', 'layout');
}
