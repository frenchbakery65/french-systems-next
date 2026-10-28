import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { SlipRekap } from './rekap';

/** Slip satu periode (urut nama) + gaji pokok di data karyawan saat ini (untuk pemeriksaan data janggal). */
export async function slipPeriode(periodeId: number) {
  const baris = await db.select({ s: schema.slipGaji, gajiPokokKaryawan: schema.karyawan.gajiPokok, uangMakanPerHari: schema.karyawan.uangMakanPerHari })
    .from(schema.slipGaji).leftJoin(schema.karyawan, eq(schema.karyawan.id, schema.slipGaji.karyawanId))
    .where(eq(schema.slipGaji.periodeGajiId, periodeId)).orderBy(asc(schema.slipGaji.nama));
  return baris.map(({ s, gajiPokokKaryawan, uangMakanPerHari }) => ({ ...(s as SlipRekap & typeof s), gajiPokokKaryawan, uangMakanPerHari: uangMakanPerHari ?? false }));
}

export async function periodeAtau404(id: number) {
  const [p] = Number.isInteger(id) ? await db.select().from(schema.periodeGaji).where(eq(schema.periodeGaji.id, id)) : [];
  return p ?? null;
}
