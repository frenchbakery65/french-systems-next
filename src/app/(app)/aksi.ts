'use server';

import { redirect } from 'next/navigation';
import { keluar } from '@/lib/auth/sesi';

export async function aksiKeluar() {
  await keluar();
  redirect('/login');
}
