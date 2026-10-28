import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { jadwalUmum } from '@/lib/pengaturan';
import { FormJadwalUmum } from './form';

export const metadata = { title: 'Pengaturan jadwal umum' };

export default async function HalamanJadwalUmum() {
  await halamanPengelola();
  return (
    <>
      <Judul judul="Pengaturan jadwal umum" />
      <FormJadwalUmum j={await jadwalUmum()} />
    </>
  );
}
