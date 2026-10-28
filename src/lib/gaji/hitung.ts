/**
 * Rumus slip gaji (port dari HitungGaji.php + SlipGaji.php), tanpa database.
 *
 *   Gaji pokok + Lembur (jam × tarif) − Potongan pinjaman          = subtotal
 *   (upah per jam = upah harian ÷ jam kerja per hari; dipakai untuk lembur dan potongan telat)
 *   Penerimaan: Uang makan + T. prestasi + Premi hadir + Komisi + Bonus
 *   Potongan  : Pot. lain + Pot. kasbon + Pot. absen (telat & tidak hadir) + Pot 5
 *   Karyawan bulanan: tidak ada "tidak hadir"; libur melebihi jatah × upah harian masuk ke pot_alpa
 *   Karyawan bulanan dipukul rata 30 hari (hari per bulan): gaji per hari = gaji pokok ÷ 30, prorata = × hari aktif (maks. 30) ÷ 30
 *   Pendapatan bersih = subtotal + penerimaan − potongan
 *
 * Kolom manual (komisi, bonus, kasbon, pinjaman, potongan lain, Pot 5, jam lembur manual, catatan)
 * tidak ditimpa saat dihitung ulang.
 */
import { maxTgl, minTgl, tambahHari, type Tgl } from '../tanggal';
import { hariKerjaUmum } from '../absensi/jadwal';
import { hariAktif, jatahPeriode, panjangPeriode } from '../absensi/jatah-libur';
import type { RekapKaryawan } from '../absensi/perhitungan';
import { pakaiJatahLibur, type AturanAbsen, type JadwalUmum, type KaryawanAbsen } from '../absensi/tipe';
import { durasi, rp } from '../format';
import { menitTelatDipotong, upah } from './upah';

export interface KaryawanGaji extends KaryawanAbsen {
  jabatan: string | null;
  tarifLemburPerJam: number;
  uangMakan: number;
  uangMakanPerHari: boolean;
  tunjanganPrestasi: number;
  premiHadir: number;
}

export interface AturanGaji extends AturanAbsen {
  potonganAlpaPerHari: number;
  lemburOtomatis: boolean;
  lemburMinimalMenit: number;
  lemburPembulatanMenit: number;
  premiHangusJikaAlpa: boolean;
  premiMaksTelat: number | null;
  prorataGajiPokok: boolean;
}

/** Isian manual HRD per slip. */
export interface Manual {
  komisi: number; bonus: number; potKasbon: number; potPinjaman: number; potLain: number; pot5: number;
  jamLemburManual: number | null; catatan: string | null;
}

export const MANUAL_KOSONG: Manual = { komisi: 0, bonus: 0, potKasbon: 0, potPinjaman: 0, potLain: 0, pot5: 0, jamLemburManual: null, catatan: null };

/** Semua angka satu slip (sama dengan kolom tabel slip_gaji). */
export interface Slip extends Manual {
  pin: string; nama: string; departemen: string | null; jabatan: string | null; jenisPekerja: string | null;
  upahHarian: number; upahPerJam: number;
  hariKerja: number; hadir: number; telat: number; menitTelat: number; menitTelatDipotong: number; alpa: number; izin: number;
  panjangPeriode: number; jatahLibur: number; liburTerpakai: number; liburLebih: number;
  jamLemburOtomatis: number;
  gajiPokok: number; tarifLembur: number; upahLembur: number;
  uangMakan: number; tunjanganPrestasi: number; premiHadir: number;
  potTelat: number; potAlpa: number;
  subtotalGaji: number; totalPenerimaan: number; totalKotor: number; totalPotongan: number; gajiBersih: number;
  catatanHitung: string | null;
}

export const jamLembur = (s: Pick<Slip, 'jamLemburManual' | 'jamLemburOtomatis'>) => s.jamLemburManual ?? s.jamLemburOtomatis;

/** Hitung semua total dari komponen yang sudah terisi. */
export function hitungTotal<T extends Omit<Slip, 'upahLembur' | 'subtotalGaji' | 'totalPenerimaan' | 'totalKotor' | 'totalPotongan' | 'gajiBersih'>>(s: T): T & Slip {
  const upahLembur = Math.round(jamLembur(s) * s.tarifLembur);
  const subtotalGaji = s.gajiPokok + upahLembur - s.potPinjaman;
  const totalPenerimaan = s.uangMakan + s.tunjanganPrestasi + s.premiHadir + s.komisi + s.bonus;
  const totalKotor = subtotalGaji + totalPenerimaan;
  const totalPotongan = s.potLain + s.potKasbon + s.potTelat + s.potAlpa + s.pot5;
  return { ...s, upahLembur, subtotalGaji, totalPenerimaan, totalKotor, totalPotongan, gajiBersih: totalKotor - totalPotongan };
}

/** Jumlah hari kerja (jadwal umum, tanpa hari libur) dalam rentang, termasuk hari yang belum lewat. */
export function hariKerjaRentang(mulai: Tgl, selesai: Tgl, jadwal: JadwalUmum, libur: Record<Tgl, string>): number {
  let n = 0;
  for (let d = mulai; d <= selesai; d = tambahHari(d, 1)) if (hariKerjaUmum(jadwal, d) && libur[d] === undefined) n++;
  return n;
}

export interface KonteksPeriode {
  mulai: Tgl;
  selesai: Tgl;
  aturan: AturanGaji;
  jadwal: JadwalUmum;
  libur: Record<Tgl, string>;
}

/** Hitung satu slip dari rekap absensi satu periode + isian manual yang sudah ada. */
export function hitungSlip(k: KaryawanGaji, r: RekapKaryawan, p: KonteksPeriode, manual: Manual = MANUAL_KOSONG): Slip {
  const { aturan, mulai, selesai } = p;
  const bulanan = pakaiJatahLibur(k);
  const catatan: string[] = [];

  // Gaji pokok, prorata jika masuk/keluar di tengah periode
  // (bulanan: dipukul rata 30 hari = hari per bulan, apa pun panjang periodenya; hari aktif maksimal 30)
  let gajiPokok = k.gajiPokok;
  const pembagi = bulanan ? Math.max(1, aturan.hariPerBulan) : hariKerjaRentang(mulai, selesai, p.jadwal, p.libur);
  if (aturan.prorataGajiPokok && pembagi > 0) {
    const awal = k.tanggalMasuk ? maxTgl(k.tanggalMasuk, mulai) : mulai;
    const akhir = k.tanggalKeluar ? minTgl(k.tanggalKeluar, selesai) : selesai;
    if (awal > mulai || akhir < selesai) {
      const hk = bulanan ? Math.min(pembagi, hariAktif(k, mulai, selesai)) : hariKerjaRentang(awal, akhir, p.jadwal, p.libur);
      gajiPokok = Math.round((k.gajiPokok * hk) / pembagi);
      catatan.push(`Gaji pokok prorata ${hk}/${pembagi} ${bulanan ? 'hari' : 'hari kerja'}`);
    }
  }
  const [upahHarian, upahPerJam] = upah(k, aturan, catatan);
  const libur = bulanan ? { jatah: r.jatahLibur ?? 0, terpakai: r.liburTerpakai, kelebihan: r.liburLebih() } : null;
  if (bulanan && hariAktif(k, mulai, selesai) < panjangPeriode(mulai, selesai)) {
    catatan.push(`Jatah libur prorata ${jatahPeriode(k, mulai, selesai)} hari (aktif ${hariAktif(k, mulai, selesai)} dari ${panjangPeriode(mulai, selesai)} hari)`);
  }

  // Lembur dari absensi (per hari, dibulatkan ke bawah)
  let jamLemburOtomatis = 0;
  if (aturan.lemburOtomatis) {
    const bulat = Math.max(1, aturan.lemburPembulatanMenit);
    for (const h of r.hari) if (h.lemburMenit >= aturan.lemburMinimalMenit) jamLemburOtomatis += (Math.floor(h.lemburMenit / bulat) * bulat) / 60;
  }
  jamLemburOtomatis = Math.round(jamLemburOtomatis * 100) / 100;
  // Upah lembur khusus per karyawan, jika tidak diisi pakai upah per jam
  const tarifLembur = k.tarifLemburPerJam > 0 ? k.tarifLemburPerJam : upahPerJam;

  // Premi hadir: Harian tidak dapat premi; Bulanan tetap penuh walau libur/tidak masuk
  let premi = k.jenisPekerja === 'Harian' ? 0 : k.premiHadir;
  if (premi && k.jenisPekerja !== 'Bulanan' && aturan.premiHangusJikaAlpa && r.alpa > 0) {
    premi = 0;
    catatan.push(`Premi hadir hangus (${r.alpa} hari tidak hadir)`);
  } else if (premi && aturan.premiMaksTelat !== null && r.telat > aturan.premiMaksTelat) {
    premi = 0;
    catatan.push(`Premi hadir hangus (telat ${r.telat}×)`);
  }

  // Potongan absen
  let menitDipotong = 0;
  let potTelat: number;
  if (aturan.metodePotonganTelat === 'per_kali') {
    potTelat = r.telat * aturan.potonganTelatPerKali;
  } else {
    // Total menit telat sebulan; di bawah batas tidak dipotong, sisanya dibulatkan ke bawah
    menitDipotong = menitTelatDipotong(r.telatMenit, aturan);
    potTelat = Math.round((menitDipotong / 60) * upahPerJam);
    if (r.telatMenit > 0 && !menitDipotong) catatan.push(`Telat ${durasi(r.telatMenit)} belum mencapai ${durasi(aturan.telatMinimalMenit)}, tidak dipotong`);
  }
  let potAlpa: number;
  if (libur) {
    // libur melebihi jatah × upah harian (gaji pokok ÷ hari per bulan); paling banyak sebesar gaji pokok, supaya gaji tidak minus
    potAlpa = Math.min(libur.kelebihan * upahHarian, gajiPokok);
    if (libur.terpakai) {
      catatan.push(`Libur ${libur.terpakai} hari, jatah ${libur.jatah}${libur.kelebihan
        ? ` → dipotong ${libur.kelebihan} × Rp${rp(upahHarian)}${potAlpa < libur.kelebihan * upahHarian ? ' (dibatasi sebesar gaji pokok)' : ''}`
        : ''}`);
    }
  } else {
    potAlpa = r.alpa * aturan.potonganAlpaPerHari;
  }

  return hitungTotal({
    ...manual,
    pin: k.pin, nama: k.nama, departemen: k.departemen, jabatan: k.jabatan, jenisPekerja: k.jenisPekerja,
    upahHarian, upahPerJam,
    hariKerja: r.hariKerja, hadir: r.hadir, telat: r.telat, menitTelat: r.telatMenit, menitTelatDipotong: menitDipotong, alpa: r.alpa,
    izin: r.sakit + r.izin + r.cuti + r.dinas,
    panjangPeriode: panjangPeriode(mulai, selesai), jatahLibur: libur?.jatah ?? 0, liburTerpakai: libur?.terpakai ?? 0, liburLebih: libur?.kelebihan ?? 0,
    jamLemburOtomatis, gajiPokok, tarifLembur,
    uangMakan: k.uangMakanPerHari ? k.uangMakan * r.hadir : k.uangMakan,
    tunjanganPrestasi: k.tunjanganPrestasi, premiHadir: premi, potTelat, potAlpa,
    catatanHitung: catatan.length ? catatan.join('; ').slice(0, 1000) : null,
  });
}

/* ---------- Tampilan slip ---------- */

/** Slip karyawan bulanan yang dihitung dengan jatah libur (slip lama tanpa angka libur tidak). */
export const slipPakaiJatah = (s: Pick<Slip, 'jenisPekerja' | 'alpa' | 'jatahLibur' | 'liburTerpakai'>) =>
  s.jenisPekerja === 'Bulanan' && !s.alpa && Boolean(s.jatahLibur || s.liburTerpakai);

/** Potongan karena libur melebihi jatah (bagian dari pot_alpa). */
export const potLibur = (s: Pick<Slip, 'liburLebih' | 'potAlpa'>) => (s.liburLebih ? s.potAlpa : 0);

/** "telat 1 jam 45 mnt, dipotong 1 jam × 10.000/jam", "telat 45 mnt (di bawah batas)", atau cara lama "telat 3×". */
export function keteranganTelat(s: Pick<Slip, 'telat' | 'menitTelat' | 'menitTelatDipotong' | 'potTelat' | 'upahPerJam'>): string | null {
  if (!s.telat) return null;
  if (!s.menitTelat || (!s.menitTelatDipotong && s.potTelat)) return `telat ${s.telat}×`;
  if (!s.menitTelatDipotong) return `telat ${durasi(s.menitTelat)} (di bawah batas)`;
  return `telat ${durasi(s.menitTelat)}, dipotong ${durasi(s.menitTelatDipotong)} × ${rp(s.upahPerJam)}/jam`;
}

/** 1.5 → "1,5"; 4 → "4". */
export const formatJam = (j: number) => j.toLocaleString('id-ID', { maximumFractionDigits: 2 });
