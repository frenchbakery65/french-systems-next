/** Pembuat data tes untuk mesin hitung (tanpa database). */
import { Perhitungan } from '@/lib/absensi/perhitungan';
import type { DataAbsensi, IzinAbsen, JadwalKhusus, KaryawanAbsen, KoreksiAbsen, PeriodeAbsen, ScanAbsen, ShiftAbsen } from '@/lib/absensi/tipe';
import { tambahHari } from '@/lib/tanggal';

export const SHIFT: ShiftAbsen[] = [
  ['SUBUH', 'Subuh produksi', '05:30:00', '14:30:00', 'info'],
  ['PROD-07', 'Produksi pagi', '07:00:00', '16:00:00', 'success'],
  ['TOKO-06', 'Toko pagi', '06:00:00', '15:00:00', 'warning'],
  ['NORMAL', 'Normal', '08:00:00', '17:00:00', 'gray'],
  ['SIANG', 'Siang', '12:00:00', '21:00:00', 'danger'],
].map(([kode, nama, jamMasuk, jamPulang, warna], i) => ({ id: i + 1, kode, nama, jamMasuk, jamPulang, warna, toleransiTelatMenit: 5, aktif: true }));

export const idShift = (kode: string) => SHIFT.find((s) => s.kode === kode)!.id;

let pinBerikut = 100;
export function karyawan(lain: Partial<KaryawanAbsen> = {}): KaryawanAbsen {
  const pin = String(++pinBerikut);
  return {
    id: pinBerikut, pin, nama: `K${pin}`, departemen: null, departemenId: null, shiftId: null, hariLiburMingguan: null,
    jenisPekerja: 'Harian', tanggalMasuk: null, tanggalKeluar: null, aktif: true, jatahLibur: 2, gajiPokok: 0, upahHarian: 0, ...lain,
  };
}

/** Kumpulan data yang bisa diisi sedikit demi sedikit lalu dihitung. */
export class Dunia {
  karyawan: KaryawanAbsen[] = [];
  scan: ScanAbsen[] = [];
  izin: IzinAbsen[] = [];
  koreksi: KoreksiAbsen[] = [];
  jadwalKhusus: JadwalKhusus[] = [];
  periodeGaji: PeriodeAbsen[] = [];
  libur: Record<string, string> = {};
  aturan = {
    tanggalTutupBuku: 29, liburNasionalKurangiJatah: false, hariPerBulan: 30, jamKerjaPerHari: 9,
    metodePotonganTelat: 'per_jam', potonganTelatPerKali: 2500, telatMinimalMenit: 60, telatPembulatanMenit: 60,
  };

  constructor(public sekarang: string) {} // "YYYY-MM-DD HH:MM:SS"

  tambah(lain: Partial<KaryawanAbsen> = {}) {
    const k = karyawan(lain);
    this.karyawan.push(k);
    return k;
  }

  log(k: KaryawanAbsen, waktu: string, statusScan: number | null = null) {
    this.scan.push({ pin: k.pin, waktuScan: waktu.length === 16 ? `${waktu}:00` : waktu, statusScan });
  }

  /** Scan masuk 07:55 & pulang 17:00 setiap hari dalam rentang, kecuali tanggal yang disebut. */
  masukSemua(k: KaryawanAbsen, mulai: string, selesai: string, kecuali: string[] = []) {
    for (let d = mulai; d <= selesai; d = tambahHari(d, 1)) {
      if (kecuali.includes(d)) continue;
      this.log(k, `${d} 07:55:00`, 0);
      this.log(k, `${d} 17:00:00`, 1);
    }
  }

  hitung(mulai: string, selesai: string, hanya?: KaryawanAbsen, satuPeriode = false) {
    const data: DataAbsensi = {
      mulai, selesai, sekarang: { tanggal: this.sekarang.slice(0, 10), jam: this.sekarang.slice(11) },
      jadwal: { jamMasuk: '08:00:00', jamPulang: '17:00:00', toleransiTelatMenit: 5, jarakMinimalPulangMenit: 60,
        senin: true, selasa: true, rabu: true, kamis: true, jumat: true, sabtu: false, minggu: false },
      aturan: this.aturan, karyawan: hanya ? [hanya] : this.karyawan, shift: SHIFT, libur: this.libur, scan: this.scan,
      izin: this.izin, koreksi: this.koreksi, jadwalKhusus: this.jadwalKhusus, periodeGaji: this.periodeGaji, satuPeriode,
    };
    return new Perhitungan(data);
  }

  hari(k: KaryawanAbsen, tgl: string) {
    return this.hitung(tgl, tgl, k).hitungHari(k, tgl);
  }

  /** Semua hari (lewat rekap, supaya urutan jatah libur terisi) mulai..selesai, per tanggal. */
  hariRekap(k: KaryawanAbsen, mulai: string, selesai: string) {
    return Object.fromEntries(this.hitung(mulai, selesai, k).rekap()[0].hari.map((h) => [h.tanggal, h]));
  }
}
