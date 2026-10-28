'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { sekarangIso, tanggalAtauNull, teks, type StateForm } from '@/lib/formulir';

export async function simpanHariLibur(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  await wajibPengelola();
  const tanggal = tanggalAtauNull(form.get('tanggal'));
  const keterangan = teks(form.get('keterangan'));
  const galat: Record<string, string> = {};
  if (!tanggal) galat.tanggal = 'Tanggal wajib diisi.';
  if (!keterangan || keterangan.length > 150) galat.keterangan = 'Keterangan wajib diisi (maks. 150 karakter).';
  if (tanggal && await db.$count(schema.hariLibur, and(eq(schema.hariLibur.tanggal, tanggal), id ? ne(schema.hariLibur.id, id) : undefined))) {
    galat.tanggal = 'Tanggal ini sudah tercatat sebagai hari libur.';
  }
  if (Object.keys(galat).length) return { galat };
  if (id) await db.update(schema.hariLibur).set({ tanggal: tanggal!, keterangan, updatedAt: sekarangIso() }).where(eq(schema.hariLibur.id, id));
  else await db.insert(schema.hariLibur).values({ tanggal: tanggal!, keterangan });
  revalidatePath('/', 'layout');
  redirect('/hari-libur');
}

export async function hapusHariLibur(id: number) {
  await wajibPengelola();
  await db.delete(schema.hariLibur).where(eq(schema.hariLibur.id, id));
  revalidatePath('/', 'layout');
}
