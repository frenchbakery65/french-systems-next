'use server';

import { redirect } from 'next/navigation';
import { masuk } from '@/lib/auth/sesi';

export async function aksiMasuk(_: unknown, form: FormData) {
  const username = String(form.get('username') ?? '');
  const hasil = await masuk(username, String(form.get('password') ?? ''));
  if (!hasil.ok) return { pesan: hasil.pesan, username };
  redirect('/');
}
