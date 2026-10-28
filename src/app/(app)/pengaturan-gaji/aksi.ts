'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/db';
import { wajibPengelola } from '@/lib/auth/sesi';
import { centang, sekarangIso, teks, type StateForm } from '@/lib/formulir';
import { pengaturanGaji } from '@/lib/pengaturan';

const uang = (v: FormDataEntryValue | null) => Number(teks(v).replace(/\D/g, '') || 0);

export async function simpanPengaturanGaji(_: StateForm, form: FormData): Promise<StateForm> {
  await wajibPengelola();
  const angka = (nama: string) => Number(teks(form.get(nama)).replace(',', '.'));
  const galat: Record<string, string> = {};
  const cek = (nama: string, min: number, maks: number, pesan: string, bulat = true) => {
    const n = angka(nama);
    if (!Number.isFinite(n) || n < min || n > maks || (bulat && !Number.isInteger(n))) galat[nama] = pesan;
    return n;
  };
  const tutup = cek('tanggalTutupBuku', 0, 30, 'Pilih tanggal tutup buku.');
  const kota = teks(form.get('kotaSlip'));
  if (!kota || kota.length > 60) galat.kotaSlip = 'Kota wajib diisi.';
  const jam = cek('jamKerjaPerHari', 1, 24, 'Isi 1–24 jam.', false);
  const hari = cek('hariPerBulan', 1, 31, 'Isi 1–31 hari.');
  const metode = teks(form.get('metodePotonganTelat')) === 'per_kali' ? 'per_kali' : 'per_jam';
  const telatMin = cek('telatMinimalMenit', 0, 600, 'Isi 0–600 menit.');
  const telatBulat = [60, 30, 15, 1].includes(angka('telatPembulatanMenit')) ? angka('telatPembulatanMenit') : 60;
  const lemburMin = cek('lemburMinimalMenit', 0, 600, 'Isi 0–600 menit.');
  const lemburBulat = [60, 30, 15, 1].includes(angka('lemburPembulatanMenit')) ? angka('lemburPembulatanMenit') : 60;
  const maksTelat = teks(form.get('premiMaksTelat')) === '' ? null : cek('premiMaksTelat', 0, 100, 'Isi angka 0–100 atau kosongkan.');
  if (Object.keys(galat).length) return { pesan: 'Periksa kembali isian yang ditandai.', galat };

  const a = await pengaturanGaji();
  await db.update(schema.pengaturanGaji).set({
    tanggalTutupBuku: tutup, kotaSlip: kota, jamKerjaPerHari: jam, hariPerBulan: hari, metodePotonganTelat: metode,
    telatMinimalMenit: telatMin, telatPembulatanMenit: telatBulat, potonganTelatPerKali: uang(form.get('potonganTelatPerKali')),
    potonganAlpaPerHari: uang(form.get('potonganAlpaPerHari')),
    defaultIzinKurangiJatah: centang(form.get('defaultIzinKurangiJatah')), defaultSakitKurangiJatah: centang(form.get('defaultSakitKurangiJatah')),
    liburNasionalKurangiJatah: centang(form.get('liburNasionalKurangiJatah')),
    lemburOtomatis: centang(form.get('lemburOtomatis')), lemburMinimalMenit: lemburMin, lemburPembulatanMenit: lemburBulat,
    premiHangusJikaAlpa: centang(form.get('premiHangusJikaAlpa')), premiMaksTelat: maksTelat, prorataGajiPokok: centang(form.get('prorataGajiPokok')),
    updatedAt: sekarangIso(),
  }).where(eq(schema.pengaturanGaji.id, a.id));
  revalidatePath('/', 'layout');
  return { ok: true, pesan: 'Pengaturan gaji disimpan. Berlaku untuk periode yang dihitung (ulang) setelah ini. Periode yang sudah final tidak berubah.' };
}
