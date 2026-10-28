import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { FormIzin } from '../form';
import { opsiIzin } from '../opsi';

export const metadata = { title: 'Catat izin / sakit / cuti' };

export default async function HalamanIzinBaru({ searchParams }: { searchParams: Promise<{ karyawan?: string; tanggal?: string }> }) {
  await halamanPengelola();
  const q = await searchParams;
  return (
    <>
      <Judul judul="Catat izin / sakit / cuti" />
      <FormIzin iz={null} {...await opsiIzin()} awal={{ karyawanId: q.karyawan, tanggal: q.tanggal, kembali: q.karyawan ? 'karyawan' : undefined }} />
    </>
  );
}
