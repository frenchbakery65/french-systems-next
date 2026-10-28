import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { Judul } from '@/components/ui';
import { halamanAdmin } from '@/lib/auth/sesi';
import { FormPengguna } from '../form';

export const metadata = { title: 'Ubah pengguna' };

export default async function HalamanUbahPengguna({ params }: { params: Promise<{ id: string }> }) {
  const saya = await halamanAdmin();
  const id = Number((await params).id);
  const [u] = Number.isInteger(id)
    ? await db.select({ id: schema.users.id, name: schema.users.name, username: schema.users.username, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, id))
    : [];
  if (!u) notFound();
  return (<><Judul judul={`Ubah ${u.name}`} /><FormPengguna u={u} diriSendiri={u.id === saya.id} /></>);
}
