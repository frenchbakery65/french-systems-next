import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { FormKaryawan } from '../../form';
import { opsiForm } from '../../opsi';

export const metadata = { title: 'Ubah karyawan' };

export default async function HalamanUbahKaryawan({ params }: { params: Promise<{ id: string }> }) {
  await halamanPengelola();
  const id = Number((await params).id);
  const [k] = Number.isInteger(id) ? await db.select().from(schema.karyawan).where(eq(schema.karyawan.id, id)) : [];
  if (!k) notFound();
  return (
    <>
      <Judul judul={`Ubah ${k.nama}`} />
      <FormKaryawan k={k} {...await opsiForm()} />
    </>
  );
}
