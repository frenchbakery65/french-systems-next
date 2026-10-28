import 'server-only';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';

/** Daftar karyawan untuk pilihan di formulir (yang aktif dulu). */
export async function pilihanKaryawan() {
  const daftar = await db.select({ id: schema.karyawan.id, nama: schema.karyawan.nama, pin: schema.karyawan.pin, aktif: schema.karyawan.aktif })
    .from(schema.karyawan).orderBy(asc(schema.karyawan.nama));
  return [...daftar.filter((k) => k.aktif), ...daftar.filter((k) => !k.aktif)];
}
