/**
 * Menerima kiriman dari Fingerspot.io. URL-nya dipasang di portal Fingerspot.io.
 * Webhook membuat scan masuk seketika dan memungkinkan menarik nama karyawan dari mesin.
 * Pekerjaan yang memanggil balik Fingerspot.io dijalankan setelah respon dikirim (after), supaya Fingerspot.io tidak menunggu.
 */
import { eq } from 'drizzle-orm';
import { after, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { klienUntuk, sinkronMesin, terimaUser } from '@/lib/fingerspot/sinkron';

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [m] = await db.select().from(schema.mesin).where(eq(schema.mesin.webhookToken, token));
  if (!m) return NextResponse.json({ success: false }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { type?: string; cloud_id?: string; data?: Record<string, unknown> };
  if (body.cloud_id && body.cloud_id !== m.cloudId) {
    return NextResponse.json({ success: false, message: 'Cloud ID tidak cocok dengan mesin ini.' }, { status: 403 });
  }
  const data = body.data ?? {};
  switch (body.type) {
    case 'attlog':
      // Data webhook tidak memuat detik, jadi log diambil ulang lewat get_attlog supaya sama persis dengan sinkron rutin.
      after(() => sinkronMesin(m));
      break;
    case 'get_userid_list': {
      const pins = ((data.pin_arr as unknown[]) ?? []).map((p) => String(p).trim()).filter(Boolean);
      const ada = new Set((await db.select({ pin: schema.karyawan.pin }).from(schema.karyawan)).map((x) => x.pin));
      const baru = pins.filter((p) => !ada.has(p));
      after(async () => {
        for (const pin of baru) await klienUntuk(m).mintaUser(pin).catch((e) => console.warn(`Minta data PIN ${pin} gagal:`, e.message));
      });
      break;
    }
    case 'get_userinfo':
      await terimaUser(m, String(data.pin ?? ''), String(data.name ?? ''));
      break;
  }
  return NextResponse.json({ success: true });
}
