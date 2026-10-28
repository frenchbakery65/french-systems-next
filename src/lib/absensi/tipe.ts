import type { Tgl } from '../tanggal';

/** Data yang dibutuhkan mesin hitung. Dimuat dari database oleh muat.ts, atau dibuat langsung di tes. */
export interface KaryawanAbsen {
  id: number;
  pin: string;
  nama: string;
  departemen: string | null;
  departemenId: number | null;
  shiftId: number | null;
  hariLiburMingguan: number[] | null;
  jenisPekerja: string;
  tanggalMasuk: Tgl | null;
  tanggalKeluar: Tgl | null;
  aktif: boolean;
  jatahLibur: number;
  gajiPokok: number;
  upahHarian: number;
}

export interface ShiftAbsen {
  id: number;
  kode: string;
  nama: string;
  jamMasuk: string;
  jamPulang: string;
  toleransiTelatMenit: number;
  warna: string | null;
  aktif: boolean;
}

export interface JadwalUmum {
  jamMasuk: string;
  jamPulang: string;
  toleransiTelatMenit: number;
  jarakMinimalPulangMenit: number;
  senin: boolean; selasa: boolean; rabu: boolean; kamis: boolean; jumat: boolean; sabtu: boolean; minggu: boolean;
}

export interface AturanAbsen {
  tanggalTutupBuku: number;
  liburNasionalKurangiJatah: boolean;
  hariPerBulan: number;
  jamKerjaPerHari: number;
  metodePotonganTelat: string;
  potonganTelatPerKali: number;
  telatMinimalMenit: number;
  telatPembulatanMenit: number;
}

export interface ScanAbsen { pin: string; waktuScan: string; statusScan: number | null }
export interface IzinAbsen { karyawanId: number; jenis: string; kurangiJatah: boolean; tanggalMulai: Tgl; tanggalSelesai: Tgl; keterangan: string | null }
export interface KoreksiAbsen { karyawanId: number; tanggal: Tgl; jamMasuk: string | null; jamPulang: string | null; alasan: string }
export interface JadwalKhusus { karyawanId: number; tanggal: Tgl; shiftId: number | null; libur: boolean }
export interface PeriodeAbsen { nama: string; tanggalMulai: Tgl; tanggalSelesai: Tgl }

export interface DataAbsensi {
  mulai: Tgl;
  selesai: Tgl;
  sekarang: { tanggal: Tgl; jam: string };
  jadwal: JadwalUmum;
  aturan: AturanAbsen;
  karyawan: KaryawanAbsen[];
  shift: ShiftAbsen[];
  /** tanggal → keterangan */
  libur: Record<Tgl, string>;
  scan: ScanAbsen[];
  izin: IzinAbsen[];
  koreksi: KoreksiAbsen[];
  jadwalKhusus: JadwalKhusus[];
  /** periode gaji yang sudah dibuat (untuk rentang jatah libur) */
  periodeGaji: PeriodeAbsen[];
  /** rentang ini tepat satu periode gaji (dipakai hitung gaji) */
  satuPeriode?: boolean;
}

export type StatusHari =
  | 'hadir' | 'telat' | 'alpa' | 'belum_hadir' | 'belum_mulai' | 'libur' | 'masuk_libur'
  | 'sakit' | 'izin' | 'cuti' | 'dinas' | 'libur_jatah' | 'libur_lebih' | 'luar_masa_kerja';

export const LABEL_STATUS: Record<StatusHari, string> = {
  hadir: 'Tepat waktu',
  telat: 'Telat',
  alpa: 'Tidak hadir',
  belum_hadir: 'Belum hadir',
  belum_mulai: 'Belum mulai shift',
  libur: 'Libur',
  masuk_libur: 'Masuk di hari libur',
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  dinas: 'Dinas luar',
  libur_jatah: 'Libur',
  libur_lebih: 'Libur lebih',
  luar_masa_kerja: '—',
};

export type Warna = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

export const WARNA_STATUS: Record<StatusHari, Warna> = {
  hadir: 'ok', telat: 'warn', alpa: 'bad', belum_hadir: 'muted', belum_mulai: 'muted',
  sakit: 'info', izin: 'info', cuti: 'info', dinas: 'info',
  libur: 'muted', masuk_libur: 'ok', luar_masa_kerja: 'muted',
  libur_jatah: 'muted', libur_lebih: 'bad',
};

export const JENIS_IZIN: Record<string, string> = { sakit: 'Sakit', izin: 'Izin', cuti: 'Cuti', dinas: 'Dinas luar' };
/** Jenis izin yang tidak pernah mengurangi jatah libur. */
export const IZIN_TANPA_JATAH = ['cuti', 'dinas'];

export const JENIS_PEKERJA = ['Bulanan', 'Harian', 'Kontrak', 'Magang'] as const;

/** Karyawan bulanan bebas memilih hari libur; libur melebihi jatah per periode dipotong gaji. */
export const pakaiJatahLibur = (k: Pick<KaryawanAbsen, 'jenisPekerja'>) => k.jenisPekerja === 'Bulanan';
