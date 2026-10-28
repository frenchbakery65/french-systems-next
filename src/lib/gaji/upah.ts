import type { AturanAbsen, KaryawanAbsen } from '../absensi/tipe';

/**
 * Upah harian karyawan dan upah per jam (= upah harian ÷ jam kerja per hari, dibulatkan ke rupiah).
 * Jika upah harian kosong: gaji pokok ÷ hari per bulan, dengan catatan untuk slip.
 */
export function upah(k: Pick<KaryawanAbsen, 'upahHarian' | 'gajiPokok'>, a: Pick<AturanAbsen, 'hariPerBulan' | 'jamKerjaPerHari'>, catatan: string[] = []): [number, number] {
  let harian = k.upahHarian;
  if (harian <= 0 && k.gajiPokok > 0) {
    harian = Math.round(k.gajiPokok / Math.max(1, a.hariPerBulan));
    catatan.push(`Upah harian dari gaji pokok ÷ ${a.hariPerBulan} hari = ${harian.toLocaleString('id-ID')}`);
  }
  const perJam = Math.round(harian / Math.max(0.01, a.jamKerjaPerHari));
  return [harian, perJam];
}

/** Menit telat yang dipotong: 0 jika di bawah batas, selain itu dibulatkan ke bawah per kelipatan. */
export function menitTelatDipotong(menit: number, a: Pick<AturanAbsen, 'telatMinimalMenit' | 'telatPembulatanMenit'>): number {
  if (menit <= 0 || menit < a.telatMinimalMenit) return 0;
  const bulat = Math.max(1, a.telatPembulatanMenit);
  return Math.floor(menit / bulat) * bulat;
}

/** Perkiraan potongan telat dari akumulasi sejak awal periode (dipakai di Hari ini). */
export function perkiraanPotonganTelat(k: Pick<KaryawanAbsen, 'upahHarian' | 'gajiPokok'>, kali: number, menit: number, a: AturanAbsen): number {
  if (a.metodePotonganTelat === 'per_kali') return kali * a.potonganTelatPerKali;
  const [, perJam] = upah(k, a);
  return Math.round((menitTelatDipotong(menit, a) / 60) * perJam);
}
