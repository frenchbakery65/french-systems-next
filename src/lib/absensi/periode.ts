import { awalBulan, akhirBulan, buatTgl, jumlahHariBulan, kurangiBulan, tambahHari, type Tgl } from '../tanggal';
import type { PeriodeAbsen } from './tipe';

/**
 * Rentang periode gaji yang berakhir di bulan `bulan`.
 * Contoh tutup buku tanggal 29: periode Sept 2026 = 30 Agu 2026 s/d 29 Sep 2026.
 * Tutup buku 0 atau yang melebihi panjang bulan memakai hari terakhir bulan.
 */
export function rentangUntuk(tutupBuku: number, bulan: Tgl): [Tgl, Tgl] {
  const akhir = (b: Tgl) => {
    const n = jumlahHariBulan(+b.slice(0, 4), +b.slice(5, 7));
    return tutupBuku <= 0 || tutupBuku >= n ? akhirBulan(b) : buatTgl(+b.slice(0, 4), +b.slice(5, 7), tutupBuku);
  };
  const awal = awalBulan(bulan);
  return [tambahHari(akhir(kurangiBulan(awal, 1)), 1), akhir(awal)];
}

/** Periode gaji yang mencakup tanggal: periode yang sudah dibuat, atau dari aturan tutup buku. */
export function rentangPeriode(tgl: Tgl, periode: PeriodeAbsen[], tutupBuku: number): { mulai: Tgl; selesai: Tgl; nama: string | null } {
  const ada = periode
    .filter((p) => p.tanggalMulai <= tgl && p.tanggalSelesai >= tgl)
    .sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai))[0];
  if (ada) return { mulai: ada.tanggalMulai, selesai: ada.tanggalSelesai, nama: ada.nama };
  for (const bulan of [tgl, kurangiBulan(tgl, -1)]) {
    const [m, s] = rentangUntuk(tutupBuku, bulan);
    if (tgl >= m && tgl <= s) return { mulai: m, selesai: s, nama: null };
  }
  return { mulai: awalBulan(tgl), selesai: akhirBulan(tgl), nama: null };
}

/** Periode gaji berurutan yang mencakup rentang [mulai, selesai]. */
export function daftarPeriode(mulai: Tgl, selesai: Tgl, periode: PeriodeAbsen[], tutupBuku: number): [Tgl, Tgl][] {
  const daftar: [Tgl, Tgl][] = [];
  for (let t = mulai; t <= selesai && daftar.length < 40;) {
    const r = rentangPeriode(t, periode, tutupBuku);
    daftar.push([r.mulai, r.selesai]);
    t = tambahHari(r.selesai, 1);
  }
  return daftar;
}
