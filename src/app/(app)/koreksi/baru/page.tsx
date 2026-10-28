import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { pilihanKaryawan } from '@/lib/pilihan';
import { FormKoreksi } from '../form';

export const metadata = { title: 'Koreksi absen' };

export default async function HalamanKoreksiBaru({ searchParams }: { searchParams: Promise<{ karyawan?: string; tanggal?: string }> }) {
  await halamanPengelola();
  const q = await searchParams;
  return (
    <>
      <Judul judul="Koreksi absen" />
      <FormKoreksi kor={null} karyawan={await pilihanKaryawan()} awal={{ karyawanId: q.karyawan, tanggal: q.tanggal, kembali: q.karyawan ? 'karyawan' : undefined }} />
    </>
  );
}
