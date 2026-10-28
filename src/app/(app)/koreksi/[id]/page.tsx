import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { pilihanKaryawan } from '@/lib/pilihan';
import { FormKoreksi } from '../form';

export const metadata = { title: 'Ubah koreksi absen' };

export default async function HalamanUbahKoreksi({ params }: { params: Promise<{ id: string }> }) {
  await halamanPengelola();
  const id = Number((await params).id);
  const [kor] = Number.isInteger(id) ? await db.select().from(schema.koreksiAbsen).where(eq(schema.koreksiAbsen.id, id)) : [];
  if (!kor) notFound();
  return (
    <>
      <Judul judul="Ubah koreksi absen" />
      <FormKoreksi kor={kor} karyawan={await pilihanKaryawan()} />
    </>
  );
}
