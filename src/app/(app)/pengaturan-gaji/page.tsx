import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { pengaturanGaji } from '@/lib/pengaturan';
import { FormPengaturanGaji } from './form';

export const metadata = { title: 'Pengaturan gaji' };

export default async function HalamanPengaturanGaji() {
  await halamanPengelola();
  return (<><Judul judul="Pengaturan gaji" /><FormPengaturanGaji a={await pengaturanGaji()} /></>);
}
