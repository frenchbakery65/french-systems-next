import 'server-only';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { AturanAbsen, JadwalUmum } from './absensi/tipe';

/** Shift awal; NORMAL mengikuti jam jadwal kerja umum. */
export const SHIFT_BAWAAN = [
  ['SUBUH', 'Subuh produksi', '05:30', '14:30', 'info'],
  ['PROD-07', 'Produksi pagi', '07:00', '16:00', 'success'],
  ['TOKO-06', 'Toko pagi', '06:00', '15:00', 'warning'],
  ['NORMAL', 'Normal', '08:00', '17:00', 'gray'],
  ['SIANG', 'Siang', '12:00', '21:00', 'danger'],
] as const;

/** Jadwal kerja umum (satu baris; dibuat dengan nilai bawaan jika belum ada). */
export async function jadwalUmum(): Promise<typeof schema.jadwalKerja.$inferSelect & JadwalUmum> {
  const [ada] = await db.select().from(schema.jadwalKerja).orderBy(asc(schema.jadwalKerja.id)).limit(1);
  if (ada) return ada;
  const [baru] = await db.insert(schema.jadwalKerja).values({}).returning();
  return baru;
}

/** Pengaturan gaji (satu baris; dibuat dengan nilai bawaan jika belum ada). */
export async function pengaturanGaji(): Promise<typeof schema.pengaturanGaji.$inferSelect & AturanAbsen> {
  const [ada] = await db.select().from(schema.pengaturanGaji).orderBy(asc(schema.pengaturanGaji.id)).limit(1);
  if (ada) return ada;
  const [baru] = await db.insert(schema.pengaturanGaji).values({}).returning();
  return baru;
}

export const namaPerusahaan = () => process.env.NAMA_PERUSAHAAN || 'French Bakery';
