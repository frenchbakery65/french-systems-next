'use server';

import { revalidatePath } from 'next/cache';
import { wajibPengelola } from '@/lib/auth/sesi';
import { isiKaryawan, saringMulaiPakai, scanPertama, simpanLog } from '@/lib/fingerspot/sinkron';
import { bacaFile } from '@/lib/impor/excel';
import { GalatImpor, parseBaris } from '@/lib/impor/parse';

export type HasilImpor = { ok: boolean; judul: string; pesan: string[] } | null;

/** Batas ukuran file (server Vercel menerima maksimal ±4,5 MB per permintaan). */
const MAKS_BYTE = 4 * 1024 * 1024;

export async function imporFile(_: HasilImpor, form: FormData): Promise<HasilImpor> {
  await wajibPengelola();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { ok: false, judul: 'Pilih file dulu', pesan: [] };
  if (file.size > MAKS_BYTE) return { ok: false, judul: 'File terlalu besar', pesan: ['Maksimal 4 MB. Pecah file per bulan, atau simpan sebagai CSV.'] };

  let hasil;
  try {
    hasil = parseBaris(await bacaFile(file.name, await file.arrayBuffer()));
  } catch (e) {
    return { ok: false, judul: 'File tidak bisa dibaca', pesan: [e instanceof GalatImpor ? e.message : `Gagal membaca file: ${(e as Error).message}`] };
  }

  // Karyawan baru dibuat dari nama di file; nama sementara ("Karyawan PIN x") diisi. Nama yang sudah diisi orang tidak diubah.
  // Scan sebelum tanggal mulai dicatat (masa uji mesin) dilewati.
  const dibaca = hasil.baris.length;
  hasil.baris = await saringMulaiPakai(hasil.baris);
  const sebelumMulai = dibaca - hasil.baris.length;

  // Karyawan baru: tanggal mulai bekerja = scan pertamanya di file (kosong untuk file daftar karyawan).
  const baru: string[] = [];
  const diisi: string[] = [];
  const pertama = scanPertama(hasil.baris);
  for (const [pin, nama] of Object.entries(hasil.karyawan)) {
    const s = await isiKaryawan(pin, nama, pertama.get(pin) ?? null);
    if (s === 'baru') baru.push(`${nama} (PIN ${pin})`);
    if (s === 'diisi') diisi.push(`${nama} (PIN ${pin})`);
  }

  const pesan: string[] = [];
  let judul: string;
  if (hasil.baris.length || sebelumMulai) {
    const jumlahBaru = await simpanLog(hasil.baris, null, 'impor');
    judul = 'Import selesai';
    pesan.push(`${hasil.baris.length} baris terbaca: ${jumlahBaru} log baru disimpan, ${hasil.baris.length - jumlahBaru} sudah ada sebelumnya (dilewati).`);
    if (sebelumMulai) pesan.push(`${sebelumMulai} baris dilewati karena sebelum tanggal absensi mulai dicatat (Pengaturan gaji).`);
    if (hasil.dilewati) pesan.push(`${hasil.dilewati} baris dilewati karena PIN, nama, atau waktunya kosong/tidak terbaca.`);
  } else {
    judul = 'Daftar karyawan diimpor';
    pesan.push(`File dibaca sebagai daftar karyawan (tanpa kolom waktu): ${Object.keys(hasil.karyawan).length} karyawan terbaca.`);
    if (hasil.dilewati) pesan.push(`${hasil.dilewati} baris dilewati karena PIN atau namanya kosong.`);
  }
  if (baru.length) pesan.push(`${baru.length} karyawan baru ditambahkan: ${baru.join(', ')}.`);
  if (diisi.length) pesan.push(`${diisi.length} nama karyawan diisi: ${diisi.join(', ')}.`);
  revalidatePath('/', 'layout');
  return { ok: true, judul, pesan };
}
