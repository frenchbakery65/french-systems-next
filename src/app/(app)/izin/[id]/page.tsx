import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { FormIzin } from '../form';
import { opsiIzin } from '../opsi';

export const metadata = { title: 'Ubah izin' };

export default async function HalamanUbahIzin({ params }: { params: Promise<{ id: string }> }) {
  await halamanPengelola();
  const id = Number((await params).id);
  const [iz] = Number.isInteger(id) ? await db.select().from(schema.izin).where(eq(schema.izin.id, id)) : [];
  if (!iz) notFound();
  return (
    <>
      <Judul judul="Ubah izin / sakit / cuti" />
      <FormIzin iz={iz} {...await opsiIzin()} />
    </>
  );
}
