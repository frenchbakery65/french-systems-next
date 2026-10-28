import { hariDalamMinggu, keMenit, type Tgl } from '../tanggal';
import { pakaiJatahLibur, type JadwalKhusus, type JadwalUmum, type KaryawanAbsen, type ShiftAbsen } from './tipe';

/** Jam kerja seorang karyawan pada satu tanggal. Jam dalam menit sejak tengah malam. */
export interface Jadwal {
  shift: ShiftAbsen | null;
  masuk: number;
  pulang: number;
  toleransi: number;
  hariKerja: boolean;
  ditebak: boolean;
  ditukar: boolean;
  liburKet: string | null;
  /** Sebab bukan hari kerja: jadwal (libur per tanggal), nasional (Hari libur), rutin (libur mingguan). */
  sebabLibur: 'jadwal' | 'nasional' | 'rutin' | null;
}

/** Selisih maksimal scan pertama dengan jam masuk shift agar shift bisa ditebak. */
export const BATAS_TEBAK_MENIT = 120;

const HARI_UMUM = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const;

export const hariKerjaUmum = (j: JadwalUmum, t: Tgl) => j[HARI_UMUM[hariDalamMinggu(t)]];

const dariShift = (s: ShiftAbsen, hariKerja: boolean, ditebak = false, ditukar = false): Jadwal => ({
  shift: s, masuk: keMenit(s.jamMasuk), pulang: keMenit(s.jamPulang), toleransi: s.toleransiTelatMenit,
  hariKerja, ditebak, ditukar, liburKet: null, sebabLibur: null,
});

/**
 * Menentukan jadwal seorang karyawan pada satu tanggal. Urutan prioritas:
 *  1. jadwal khusus pada tanggal itu (tukar shift / libur)
 *  2. hari libur nasional/perusahaan
 *  3. libur rutin mingguan karyawan (atau bukan hari kerja di jadwal umum bila tidak diisi);
 *     karyawan bulanan tidak punya libur rutin (bebas memilih libur, lihat jatah-libur.ts)
 *  4. shift bawaan karyawan
 *  5. belum punya shift → ditebak dari scan pertama (shift aktif dengan jam masuk terdekat, maks. 2 jam),
 *     selain itu jam jadwal umum. Tebakan hanya cadangan; shift yang sudah ditentukan tidak pernah ditimpa.
 */
export class JadwalHarian {
  private shiftPerId = new Map<number, ShiftAbsen>();
  private khusus = new Map<string, JadwalKhusus>();

  constructor(shift: ShiftAbsen[], khusus: JadwalKhusus[], public umum: JadwalUmum, public libur: Record<Tgl, string>) {
    for (const s of shift) this.shiftPerId.set(s.id, s);
    for (const j of khusus) this.khusus.set(`${j.karyawanId}|${j.tanggal}`, j);
  }

  untuk(k: KaryawanAbsen, tgl: Tgl, menitScanPertama: number | null = null): Jadwal {
    const khusus = this.khusus.get(`${k.id}|${tgl}`);
    const bawaan = k.shiftId ? this.shiftPerId.get(k.shiftId) ?? null : null;

    if (khusus?.libur) return this.hariLibur(bawaan, 'Libur (jadwal)', 'jadwal', true);
    const tukar = khusus?.shiftId ? this.shiftPerId.get(khusus.shiftId) : undefined;
    if (tukar) return dariShift(tukar, true, false, true);
    if (this.libur[tgl] !== undefined) return this.hariLibur(bawaan, this.libur[tgl], 'nasional');

    const rutin = k.hariLiburMingguan;
    const hariKerja = pakaiJatahLibur(k) || (Array.isArray(rutin)
      ? !rutin.map(Number).includes(hariDalamMinggu(tgl))
      : hariKerjaUmum(this.umum, tgl));
    if (!hariKerja) return this.hariLibur(bawaan, null, 'rutin');
    if (bawaan) return dariShift(bawaan, true);
    const tebak = menitScanPertama !== null ? this.tebak(menitScanPertama) : null;
    if (tebak) return dariShift(tebak, true, true);
    return this.umumJadwal(true);
  }

  /** Shift aktif dengan jam masuk paling dekat ke scan pertama (selisih maks. 2 jam). */
  tebak(menitScan: number): ShiftAbsen | null {
    return [...this.shiftPerId.values()]
      .filter((s) => s.aktif)
      .map((s) => [s, Math.abs(keMenit(s.jamMasuk) - menitScan)] as const)
      .filter(([, d]) => d <= BATAS_TEBAK_MENIT)
      .sort((a, b) => a[1] - b[1] || keMenit(a[0].jamMasuk) - keMenit(b[0].jamMasuk))[0]?.[0] ?? null;
  }

  private umumJadwal(hariKerja: boolean, ditukar = false): Jadwal {
    return {
      shift: null, masuk: keMenit(this.umum.jamMasuk), pulang: keMenit(this.umum.jamPulang), toleransi: this.umum.toleransiTelatMenit,
      hariKerja, ditebak: false, ditukar, liburKet: null, sebabLibur: null,
    };
  }

  private hariLibur(bawaan: ShiftAbsen | null, ket: string | null, sebab: Jadwal['sebabLibur'], ditukar = false): Jadwal {
    const j = bawaan ? dariShift(bawaan, false, false, ditukar) : this.umumJadwal(false, ditukar);
    return { ...j, liburKet: ket, sebabLibur: sebab };
  }
}
