import 'server-only';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { pengaturanGaji } from '@/lib/pengaturan';

/** Pilihan departemen & shift untuk formulir karyawan. */
export async function opsiForm() {
  const [departemen, shift, aturan] = await Promise.all([
    db.select({ id: schema.departemen.id, nama: schema.departemen.nama }).from(schema.departemen).orderBy(asc(schema.departemen.nama)),
    db.select().from(schema.shift).orderBy(asc(schema.shift.jamMasuk)),
    pengaturanGaji(),
  ]);
  return {
    departemen,
    shift: shift.map((s) => ({ id: s.id, aktif: s.aktif, label: `${s.kode} · ${s.nama} (${s.jamMasuk.slice(0, 5)}–${s.jamPulang.slice(0, 5)})` })),
    jamKerjaPerHari: aturan.jamKerjaPerHari,
  };
}
