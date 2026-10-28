import { penggunaSaatIni } from '@/lib/auth/sesi';
import { templateImpor } from '@/lib/impor/excel';

export async function GET() {
  if (!(await penggunaSaatIni())) return new Response('Silakan masuk.', { status: 401 });
  return new Response(new Uint8Array(await templateImpor()), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-import-absensi.xlsx"',
    },
  });
}
