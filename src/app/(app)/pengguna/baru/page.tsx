import { Judul } from '@/components/ui';
import { halamanAdmin } from '@/lib/auth/sesi';
import { FormPengguna } from '../form';

export const metadata = { title: 'Tambah pengguna' };

export default async function HalamanPenggunaBaru() {
  await halamanAdmin();
  return (<><Judul judul="Tambah pengguna" /><FormPengguna u={null} diriSendiri={false} /></>);
}
