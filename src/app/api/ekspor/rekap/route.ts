import { penggunaSaatIni } from '@/lib/auth/sesi';
import { rentangFilter } from '@/lib/absensi/filter';
import { muatPerhitungan } from '@/lib/absensi/muat';
import { eksporRekapAbsensi, unduhXlsx } from '@/lib/excel';
import { hariIni } from '@/lib/tanggal';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await penggunaSaatIni())) return new Response('Silakan masuk.', { status: 401 });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const [mulai, selesai] = rentangFilter(q, hariIni());
  const departemenId = q.departemen && /^\d+$/.test(q.departemen) ? Number(q.departemen) : null;
  const hitung = await muatPerhitungan(mulai, selesai, { departemenId });
  return unduhXlsx(await eksporRekapAbsensi(hitung, hitung.rekap()), `rekap-absensi-${mulai.replaceAll('-', '')}-${selesai.replaceAll('-', '')}.xlsx`);
}
