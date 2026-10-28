import 'server-only';
import { pengaturanGaji } from '@/lib/pengaturan';
import { pilihanKaryawan } from '@/lib/pilihan';

export async function opsiIzin() {
  const [karyawan, a] = await Promise.all([pilihanKaryawan(), pengaturanGaji()]);
  return { karyawan, bawaanJatah: { izin: a.defaultIzinKurangiJatah, sakit: a.defaultSakitKurangiJatah, cuti: false, dinas: false } };
}
