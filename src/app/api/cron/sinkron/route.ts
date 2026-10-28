/**
 * Sinkron cadangan dari Vercel Cron (lihat vercel.json). Di paket Hobby hanya 1×/hari;
 * scan harian tetap masuk seketika lewat webhook. Di paket Pro jadwal bisa dipercepat (mis. tiap 5 menit).
 */
import { NextResponse } from 'next/server';
import { bersihkanRiwayat, sinkronSemua } from '@/lib/fingerspot/sinkron';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia || req.headers.get('authorization') !== `Bearer ${rahasia}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const hasil = await sinkronSemua();
  await bersihkanRiwayat(30);
  return NextResponse.json({ ok: true, hasil });
}
