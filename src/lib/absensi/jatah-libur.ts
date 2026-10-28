/**
 * Jatah libur karyawan bulanan.
 *
 * - Tidak ada libur rutin: semua hari dalam periode gaji adalah hari kerja, karyawan bebas memilih hari liburnya.
 * - Libur terpakai = hari tanpa scan/koreksi + izin/sakit yang ditandai "mengurangi jatah libur".
 *   Cuti dan dinas luar tidak pernah mengurangi jatah; libur nasional hanya jika diatur di Pengaturan gaji.
 * - Dihitung berurutan per tanggal: libur ke-1 s/d ke-jatah masih dalam jatah, selebihnya "libur lebih".
 * - Potongan = kelebihan × upah harian (gaji pokok ÷ hari per bulan). Jatah tidak terpakai hangus.
 */
import { formatTglBulan, selisihHari, maxTgl, minTgl, type Tgl } from '../tanggal';
import type { HariAbsen, RekapKaryawan } from './perhitungan';
import { LABEL_STATUS, type KaryawanAbsen } from './tipe';

export const panjangPeriode = (mulai: Tgl, selesai: Tgl) => selisihHari(mulai, selesai) + 1;

/** Jumlah tanggal dalam periode saat karyawan sudah masuk dan belum keluar. */
export function hariAktif(k: Pick<KaryawanAbsen, 'tanggalMasuk' | 'tanggalKeluar'>, mulai: Tgl, selesai: Tgl): number {
  const awal = k.tanggalMasuk ? maxTgl(k.tanggalMasuk, mulai) : mulai;
  const akhir = k.tanggalKeluar ? minTgl(k.tanggalKeluar, selesai) : selesai;
  return akhir < awal ? 0 : panjangPeriode(awal, akhir);
}

/** Jatah satu periode; prorata = floor(jatah × hari aktif ÷ panjang periode) jika masuk atau keluar di tengah periode. */
export function jatahPeriode(k: Pick<KaryawanAbsen, 'tanggalMasuk' | 'tanggalKeluar' | 'jatahLibur'>, mulai: Tgl, selesai: Tgl): number {
  const panjang = panjangPeriode(mulai, selesai);
  const aktif = hariAktif(k, mulai, selesai);
  return aktif >= panjang ? k.jatahLibur : Math.floor((k.jatahLibur * aktif) / panjang);
}

/** Awal periode gaji baru saat menelusuri tanggal: jatah dihitung ulang, libur terpakai mulai dari 0 (sisa hangus). */
export function mulaiPeriodeJatah(r: RekapKaryawan, periode: [Tgl, Tgl]) {
  r.periodeJatah = periode;
  r.jatahLibur = jatahPeriode(r.karyawan, periode[0], periode[1]);
  r.liburTerpakai = 0;
  r.tanggalLibur = [];
}

/** Catat satu tanggal: libur ke-1..jatah = libur_jatah (digaji), setelahnya libur_lebih (dipotong). */
export function catatLibur(r: RekapKaryawan, h: HariAbsen) {
  if (!h.pakaiJatah) return;
  h.liburKe = ++r.liburTerpakai;
  h.jatahLibur = r.jatahLibur ?? 0;
  if (h.status === 'libur_jatah' && h.melebihiJatah()) h.status = 'libur_lebih';
  r.tanggalLibur.push(h);
}

/** "Libur 1 dari 2 · sisa 1" atau "Libur 3 dari 2 · lebih 1". */
export function ringkasJatah(r: RekapKaryawan): string {
  return `Libur ${r.liburTerpakai} dari ${r.jatahLibur} · ${r.liburLebih() ? `lebih ${r.liburLebih()}` : `sisa ${r.sisaJatah()}`}`;
}

/** Daftar tanggal libur periode berjalan, mis. "2 Sep, 9 Sep (izin), 16 Sep — lebih". */
export function daftarTanggalLibur(r: RekapKaryawan): string {
  return r.tanggalLibur.map((h) => formatTglBulan(h.tanggal)
    + (h.status !== 'libur_jatah' && h.status !== 'libur_lebih' ? ` (${(LABEL_STATUS[h.status] ?? h.status).toLowerCase()})` : '')
    + (h.melebihiJatah() ? ' — lebih' : '')).join(', ');
}
