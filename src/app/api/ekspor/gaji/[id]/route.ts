import { bisaMengelola, penggunaSaatIni } from '@/lib/auth/sesi';
import { eksporGaji, unduhXlsx } from '@/lib/excel';
import { periodeAtau404, slipPeriode } from '@/lib/gaji/muat';
import { segarkan } from '@/lib/gaji/periode-db';

export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!bisaMengelola(await penggunaSaatIni())) return new Response('Tidak boleh.', { status: 403 });
  const p = await periodeAtau404(Number((await params).id));
  if (!p) return new Response('Periode tidak ditemukan.', { status: 404 });
  await segarkan(p);
  const nama = p.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return unduhXlsx(await eksporGaji(await slipPeriode(p.id)), `gaji-${nama}.xlsx`);
}
