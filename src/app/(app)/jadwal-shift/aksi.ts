'use server';

import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { sekarangIso, tanggalAtauNull, teks, teksAtauNull, type StateForm } from '@/lib/formulir';
import { selisihHari, tambahHari, validTgl } from '@/lib/tanggal';

/**
 * Atur jadwal satu karyawan pada satu tanggal. pilihan: id shift, "libur", atau "bawaan"
 * (hapus jadwal khusus sehingga kembali ke shift bawaan).
 */
async function atur(karyawanId: number, tanggal: string, pilihan: string, catatan: string | null, userId: number) {
  const kunci = and(eq(schema.jadwalKaryawan.karyawanId, karyawanId), eq(schema.jadwalKaryawan.tanggal, tanggal));
  if (pilihan === 'bawaan' || pilihan === '') {
    await db.delete(schema.jadwalKaryawan).where(kunci);
    return;
  }
  const nilai = { shiftId: pilihan === 'libur' ? null : Number(pilihan), libur: pilihan === 'libur', catatan, dibuatOleh: userId, updatedAt: sekarangIso() };
  await db.insert(schema.jadwalKaryawan).values({ karyawanId, tanggal, ...nilai })
    .onConflictDoUpdate({ target: [schema.jadwalKaryawan.karyawanId, schema.jadwalKaryawan.tanggal], set: nilai });
}

const pilihanValid = (p: string) => p === 'bawaan' || p === 'libur' || /^\d+$/.test(p);

export async function ubahSel(karyawanId: number, tanggal: string, _: StateForm, form: FormData): Promise<StateForm> {
  const u = await wajibPengelola();
  const pilihan = teks(form.get('pilihan'));
  if (!validTgl(tanggal) || !pilihanValid(pilihan)) return { pesan: 'Pilihan tidak valid.' };
  await atur(karyawanId, tanggal, pilihan, teksAtauNull(form.get('catatan')), u.id);
  revalidatePath('/', 'layout');
  return { ok: true, pesan: 'Jadwal disimpan.' };
}

/** Salin tukar shift & libur dari minggu sebelumnya ke minggu yang dimulai `awal`. */
export async function salinMingguLalu(awal: string, idKaryawan: number[]): Promise<StateForm> {
  const u = await wajibPengelola();
  if (!validTgl(awal) || !idKaryawan.length) return { pesan: 'Tidak ada yang disalin.' };
  const sumber = await db.select().from(schema.jadwalKaryawan).where(and(
    inArray(schema.jadwalKaryawan.karyawanId, idKaryawan), gte(schema.jadwalKaryawan.tanggal, tambahHari(awal, -7)), lt(schema.jadwalKaryawan.tanggal, awal),
  ));
  for (const j of sumber) await atur(j.karyawanId, tambahHari(j.tanggal, 7), j.libur ? 'libur' : String(j.shiftId), j.catatan, u.id);
  revalidatePath('/', 'layout');
  return { ok: true, pesan: `${sumber.length} jadwal disalin dari minggu lalu.` };
}

export async function aturBanyak(_: StateForm, form: FormData): Promise<StateForm> {
  const u = await wajibPengelola();
  const karyawan = form.getAll('karyawan').map(Number).filter(Number.isInteger);
  const dari = tanggalAtauNull(form.get('dari'));
  const sampai = tanggalAtauNull(form.get('sampai'));
  const pilihan = teks(form.get('pilihan'));
  const galat: Record<string, string> = {};
  if (!karyawan.length) galat.karyawan = 'Pilih minimal satu karyawan.';
  if (!dari) galat.dari = 'Isi tanggal.';
  if (!sampai) galat.sampai = 'Isi tanggal.';
  else if (dari && sampai < dari) galat.sampai = 'Tidak boleh sebelum tanggal mulai.';
  else if (dari && selisihHari(dari, sampai) > 62) galat.sampai = 'Rentang maksimal 2 bulan.';
  if (!pilihanValid(pilihan)) galat.pilihan = 'Pilih shift.';
  if (Object.keys(galat).length) return { galat };
  let n = 0;
  for (let d = dari!; d <= sampai!; d = tambahHari(d, 1)) {
    for (const id of karyawan) { await atur(id, d, pilihan, teksAtauNull(form.get('catatan')), u.id); n++; }
  }
  revalidatePath('/', 'layout');
  return { ok: true, pesan: `${n} jadwal diperbarui.` };
}
