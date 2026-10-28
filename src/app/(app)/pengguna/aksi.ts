'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { hashPassword, PERAN, rapikanUsername, wajibAdmin } from '@/lib/auth/sesi';
import { sekarangIso, teks, type StateForm } from '@/lib/formulir';

/** Username: huruf kecil, angka, titik, garis bawah, strip; 3–50 karakter. */
const POLA_USERNAME = /^[a-z0-9._-]{3,50}$/;

function cekPassword(pw: string, ulang: string, wajib: boolean, galat: Record<string, string>) {
  if (!pw && !wajib) return;
  if (pw.length < 8) galat.password = 'Password minimal 8 karakter.';
  else if (pw !== ulang) galat.ulang = 'Ulangi password tidak sama.';
}

export async function simpanPengguna(id: number | null, _: StateForm, form: FormData): Promise<StateForm> {
  const saya = await wajibAdmin();
  const name = teks(form.get('name'));
  const username = rapikanUsername(teks(form.get('username')));
  const role = teks(form.get('role'));
  const pw = String(form.get('password') ?? '');
  const galat: Record<string, string> = {};
  if (!name || name.length > 150) galat.name = 'Nama wajib diisi.';
  if (!POLA_USERNAME.test(username)) galat.username = 'Username 3–50 karakter, hanya huruf kecil, angka, titik (.), garis bawah (_), dan strip (-).';
  else if (await db.$count(schema.users, and(eq(schema.users.username, username), id ? ne(schema.users.id, id) : undefined))) galat.username = 'Username sudah dipakai.';
  if (!(role in PERAN) && id !== saya.id) galat.role = 'Pilih peran.';
  cekPassword(pw, String(form.get('ulang') ?? ''), !id, galat);
  if (Object.keys(galat).length) return { galat };

  const nilai = {
    name, username, updatedAt: sekarangIso(),
    ...(id !== saya.id ? { role } : {}), // peran sendiri tidak bisa diubah
    ...(pw ? { passwordHash: await hashPassword(pw) } : {}),
  };
  if (id) {
    await db.update(schema.users).set(nilai).where(eq(schema.users.id, id));
    if (pw) await db.delete(schema.sesi).where(eq(schema.sesi.userId, id)); // password diganti → semua sesi lama keluar
  } else {
    await db.insert(schema.users).values({ ...nilai, role, passwordHash: nilai.passwordHash! });
  }
  revalidatePath('/pengguna');
  redirect(id === saya.id && pw ? '/login' : '/pengguna');
}

export async function hapusPengguna(id: number) {
  const saya = await wajibAdmin();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u || u.id === saya.id) return; // tidak bisa menghapus akun sendiri
  if (u.role === 'admin' && await db.$count(schema.users, eq(schema.users.role, 'admin')) <= 1) return; // admin terakhir
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath('/pengguna');
}
