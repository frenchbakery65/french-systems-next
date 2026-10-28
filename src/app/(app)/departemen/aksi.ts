'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { sekarangIso, teks, type StateForm } from '@/lib/formulir';

export async function simpanDepartemen(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  await wajibPengelola();
  const nama = teks(form.get('nama'));
  if (!nama || nama.length > 100) return { galat: { nama: 'Nama departemen wajib diisi (maks. 100 karakter).' } };
  if (await db.$count(schema.departemen, and(eq(schema.departemen.nama, nama), id ? ne(schema.departemen.id, id) : undefined))) {
    return { galat: { nama: 'Nama departemen sudah ada.' } };
  }
  if (id) await db.update(schema.departemen).set({ nama, updatedAt: sekarangIso() }).where(eq(schema.departemen.id, id));
  else await db.insert(schema.departemen).values({ nama });
  revalidatePath('/', 'layout');
  redirect('/departemen');
}

export async function hapusDepartemen(id: number) {
  await wajibPengelola();
  await db.delete(schema.departemen).where(eq(schema.departemen.id, id)); // karyawan → tanpa departemen
  revalidatePath('/', 'layout');
}
