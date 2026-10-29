'use server';

import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { adalahAdmin, wajibGaji } from '@/lib/auth/sesi';
import { formatDmy } from '@/lib/tanggal';
import { tanggalAtauNull, teks, type StateForm } from '@/lib/formulir';
import { hitungPeriode, PeriodeFinal, ubahManual } from '@/lib/gaji/periode-db';

export async function buatPeriode(_: StateForm, form: FormData): Promise<StateForm> {
  await wajibGaji();
  const nama = teks(form.get('nama'));
  const mulai = tanggalAtauNull(form.get('tanggalMulai'));
  const selesai = tanggalAtauNull(form.get('tanggalSelesai'));
  const slip = tanggalAtauNull(form.get('tanggalSlip'));
  const galat: Record<string, string> = {};
  if (!nama || nama.length > 60) galat.nama = 'Nama wajib diisi.';
  if (!mulai) galat.tanggalMulai = 'Isi tanggal.';
  if (!selesai) galat.tanggalSelesai = 'Isi tanggal.';
  else if (mulai && selesai < mulai) galat.tanggalSelesai = 'Tidak boleh sebelum tanggal mulai.';
  if (mulai && selesai && !galat.tanggalSelesai) {
    // setiap tanggal hanya boleh masuk satu periode
    const [bentrok] = await db.select().from(schema.periodeGaji)
      .where(and(lte(schema.periodeGaji.tanggalMulai, selesai), gte(schema.periodeGaji.tanggalSelesai, mulai))).limit(1);
    if (bentrok) galat.tanggalSelesai = `Tanggal ini bertabrakan dengan periode "${bentrok.nama}" (${formatDmy(bentrok.tanggalMulai)} – ${formatDmy(bentrok.tanggalSelesai)}). Setiap tanggal hanya boleh masuk satu periode.`;
  }
  if (Object.keys(galat).length) return { galat };
  const [p] = await db.insert(schema.periodeGaji).values({ nama, tanggalMulai: mulai!, tanggalSelesai: selesai!, tanggalSlip: slip }).returning();
  await hitungPeriode(p);
  revalidatePath('/periode-gaji');
  redirect(`/periode-gaji/${p.id}`);
}

export async function hapusPeriode(id: number) {
  await wajibGaji();
  await db.delete(schema.periodeGaji).where(and(eq(schema.periodeGaji.id, id), ne(schema.periodeGaji.status, 'final')));
  revalidatePath('/periode-gaji');
}

async function ambil(id: number) {
  const [p] = await db.select().from(schema.periodeGaji).where(eq(schema.periodeGaji.id, id));
  if (!p) throw new Error('Periode tidak ditemukan.');
  return p;
}

export async function hitungUlang(id: number): Promise<string> {
  await wajibGaji();
  try {
    const n = await hitungPeriode(await ambil(id));
    revalidatePath(`/periode-gaji/${id}`);
    return `${n} slip dihitung ulang.`;
  } catch (e) {
    return e instanceof PeriodeFinal ? e.message : `Gagal: ${(e as Error).message}`;
  }
}

export async function kunci(id: number) {
  const u = await wajibGaji();
  const p = await ambil(id);
  // hitung ulang dengan absensi terbaru lalu kunci dalam satu transaksi, supaya yang dikunci bukan angka lama
  if (p.status !== 'final') await hitungPeriode(p, { kunciOleh: u.id });
  revalidatePath('/periode-gaji', 'layout');
}

export async function bukaKunci(id: number) {
  const u = await wajibGaji();
  if (!adalahAdmin(u)) throw new Error('Hanya admin yang boleh membuka kunci.');
  await db.update(schema.periodeGaji).set({ status: 'draf', dikunciOleh: null, dikunciPada: null }).where(eq(schema.periodeGaji.id, id));
  revalidatePath('/periode-gaji', 'layout');
}

export async function ubahSlip(slipId: number, periodeId: number, _: StateForm, form: FormData): Promise<StateForm> {
  await wajibGaji();
  const uang = (n: string) => Number(teks(form.get(n)).replace(/\D/g, '') || 0);
  const jam = teks(form.get('jamLemburManual')).replace(',', '.');
  if (jam && (!Number.isFinite(Number(jam)) || Number(jam) < 0 || Number(jam) > 500)) return { galat: { jamLemburManual: 'Isi jam lembur 0–500, atau kosongkan.' } };
  const catatan = teks(form.get('catatan'));
  try {
    const s = await ubahManual(slipId, {
      tunjanganProfesi: uang('tunjanganProfesi'), bonus: uang('bonus'), potKasbon: uang('potKasbon'),
      potLain: uang('potLain'), jamLemburManual: jam ? Number(jam) : null, catatan: catatan ? catatan.slice(0, 255) : null,
    });
    revalidatePath(`/periode-gaji/${periodeId}`);
    return { ok: true, pesan: `Slip ${s.nama} disimpan. Gaji bersih: Rp ${s.gajiBersih.toLocaleString('id-ID')}` };
  } catch (e) {
    return { pesan: (e as Error).message };
  }
}
