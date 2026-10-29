/**
 * Login dengan username + password, sesi disimpan di database.
 * Cookie hanya berisi token acak; database menyimpan hash SHA-256-nya, jadi kebocoran database
 * tidak membocorkan sesi aktif. Tidak ada reset password lewat email (diatur admin).
 */
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db, schema } from '@/db';
import type { User } from '@/db/schema';
import { adalahAdmin, bisaGaji, bisaMengelola } from './peran';

export { adalahAdmin, bisaGaji, bisaMengelola, PERAN, type Peran } from './peran';

const NAMA_COOKIE = 'sesi';
const MASA_SESI_HARI = 30;
const BATAS_GAGAL = 5;
const JENDELA_GAGAL_MENIT = 15;

export type Pengguna = Pick<User, 'id' | 'name' | 'username' | 'role'>;

let dummy: string | undefined;

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export const rapikanUsername = (v: string) => v.replace(/\s+/g, '').toLowerCase();

export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);


export type HasilLogin = { ok: true } | { ok: false; pesan: string };

export async function masuk(usernameMentah: string, password: string): Promise<HasilLogin> {
  const username = rapikanUsername(usernameMentah);
  const sejak = new Date(Date.now() - JENDELA_GAGAL_MENIT * 60_000);
  const gagal = await db.$count(schema.loginGagal, and(eq(schema.loginGagal.username, username), gt(schema.loginGagal.waktu, sejak)));
  if (gagal >= BATAS_GAGAL) return { ok: false, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${JENDELA_GAGAL_MENIT} menit.` };

  const [u] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  // bandingkan tetap dijalankan walau user tidak ada, supaya waktu respons tidak membocorkan username
  dummy ??= await bcrypt.hash('bukan-password', 11);
  const cocok = await bcrypt.compare(password, u?.passwordHash ?? dummy);
  if (!u || !cocok) {
    await db.insert(schema.loginGagal).values({ username });
    return { ok: false, pesan: 'Username atau password salah.' };
  }
  await db.delete(schema.loginGagal).where(eq(schema.loginGagal.username, username));

  const token = randomBytes(32).toString('base64url');
  const kedaluwarsa = new Date(Date.now() + MASA_SESI_HARI * 86_400_000);
  await db.insert(schema.sesi).values({ id: hashToken(token), userId: u.id, kedaluwarsa });
  await db.delete(schema.sesi).where(lt(schema.sesi.kedaluwarsa, new Date())); // bersihkan sesi lama
  // Secure hanya jika diakses lewat HTTPS (Vercel selalu HTTPS); lewat http://IP-lokal cookie Secure akan dibuang browser.
  const https = (await headers()).get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
  (await cookies()).set(NAMA_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: https, path: '/', expires: kedaluwarsa });
  return { ok: true };
}

export async function keluar() {
  const jar = await cookies();
  const token = jar.get(NAMA_COOKIE)?.value;
  if (token) await db.delete(schema.sesi).where(eq(schema.sesi.id, hashToken(token)));
  jar.delete(NAMA_COOKIE);
}

/** Pengguna yang sedang login (sekali per request). */
export const penggunaSaatIni = cache(async (): Promise<Pengguna | null> => {
  const token = (await cookies()).get(NAMA_COOKIE)?.value;
  if (!token) return null;
  const [baris] = await db
    .select({ id: schema.users.id, name: schema.users.name, username: schema.users.username, role: schema.users.role })
    .from(schema.sesi)
    .innerJoin(schema.users, eq(schema.users.id, schema.sesi.userId))
    .where(and(eq(schema.sesi.id, hashToken(token)), gt(schema.sesi.kedaluwarsa, new Date())))
    .limit(1);
  return baris ?? null;
});

/** Wajib login; jika belum, diarahkan ke halaman login. */
export async function wajibLogin(): Promise<Pengguna> {
  const u = await penggunaSaatIni();
  if (!u) redirect('/login');
  return u;
}

/** Wajib Admin/HRD/Admin absensi (untuk halaman & aksi yang mengubah data absensi). */
export async function wajibPengelola(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (!bisaMengelola(u)) throw new Error('Anda tidak punya akses untuk mengubah data ini.');
  return u;
}

/** Untuk halaman pengelola absensi: pengguna lain dikembalikan ke Hari ini. */
export async function halamanPengelola(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (!bisaMengelola(u)) redirect('/');
  return u;
}

/** Wajib Admin/HRD (aksi penggajian). */
export async function wajibGaji(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (!bisaGaji(u)) throw new Error('Anda tidak punya akses ke data gaji.');
  return u;
}

/** Untuk halaman penggajian: pengguna lain dikembalikan ke Hari ini. */
export async function halamanGaji(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (!bisaGaji(u)) redirect('/');
  return u;
}

/** Wajib Admin (pengguna & pengaturan mesin). */
export async function wajibAdmin(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (!adalahAdmin(u)) throw new Error('Hanya admin yang boleh mengubah data ini.');
  return u;
}

/** Untuk halaman khusus Admin: pengguna lain dikembalikan ke Hari ini. */
export async function halamanAdmin(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (!adalahAdmin(u)) redirect('/');
  return u;
}
