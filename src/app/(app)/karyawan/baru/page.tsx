import { Judul } from '@/components/ui';
import { bisaGaji, halamanPengelola } from '@/lib/auth/sesi';
import { FormKaryawan } from '../form';
import { opsiForm } from '../opsi';

export const metadata = { title: 'Tambah karyawan' };

export default async function HalamanTambahKaryawan({ searchParams }: { searchParams: Promise<{ pin?: string }> }) {
  const gaji = bisaGaji(await halamanPengelola());
  const { pin } = await searchParams;
  return (
    <>
      <Judul judul="Tambah karyawan" />
      <FormKaryawan k={null} pinAwal={pin} gaji={gaji} {...await opsiForm()} />
    </>
  );
}
