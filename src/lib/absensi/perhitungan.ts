/**
 * Mengubah log mentah menjadi status harian dan rekap per periode (port dari Perhitungan.php).
 *
 * Aturan singkat:
 * - Jam masuk  = scan pertama berstatus Masuk. Jika mesin tidak mengirim status Pulang, dipakai scan pertama hari itu.
 * - Jam pulang = scan terakhir berstatus Pulang. Jika tidak ada, dipakai scan terakhir asalkan berjarak minimal
 *                N menit dari scan pertama (diatur di Jadwal kerja).
 * - Koreksi manual menimpa jam masuk/pulang hasil mesin (log asli tetap utuh).
 * - Jam kerja per karyawan per tanggal dari JadwalHarian (shift bawaan, tukar shift, libur rutin).
 * - Telat jika jam masuk > jam masuk shift + toleransi shift. Menit telat dihitung dari jam masuk shift.
 * - Karyawan bulanan: semua hari adalah hari kerja; hari tanpa scan menjadi libur yang memakai jatah
 *   per periode gaji (libur_jatah / libur_lebih, lihat jatah-libur.ts), bukan "tidak hadir".
 */
import { keMenit, minTgl, tambahHari, type Tgl } from '../tanggal';
import { JadwalHarian } from './jadwal';
import { catatLibur, mulaiPeriodeJatah } from './jatah-libur';
import { daftarPeriode } from './periode';
import {
  IZIN_TANPA_JATAH, JENIS_IZIN, LABEL_STATUS, WARNA_STATUS, pakaiJatahLibur,
  type DataAbsensi, type IzinAbsen, type KaryawanAbsen, type KoreksiAbsen, type ScanAbsen, type StatusHari, type Warna,
} from './tipe';

export const STATUS_MASUK = [0, 2, 3, 4];
export const STATUS_PULANG = [1, 5];

/** Status absensi satu karyawan pada satu tanggal. Jam disimpan sebagai "HH:MM:SS". */
export class HariAbsen {
  jamMasuk: string | null = null;
  jamPulang: string | null = null;
  telatMenit = 0;
  pulangCepatMenit = 0;
  durasiMenit = 0;
  /** Menit kerja di luar jadwal: setelah jam pulang (hari kerja) atau seluruh durasi (hari libur). */
  lemburMenit = 0;
  jumlahScan = 0;
  lupaPulang = false;
  tanpaScanMasuk = false;
  dikoreksi = false;
  hariKerja = false;
  catatan = '';
  shiftKode: string | null = null;
  shiftNama: string | null = null;
  shiftWarna: string | null = null;
  /** Shift ditebak dari scan pertama (karyawan belum punya shift bawaan) — perlu dicek HRD. */
  shiftDitebak = false;
  /** Jadwal hari itu ditukar lewat Jadwal shift (bukan shift bawaan). */
  shiftDitukar = false;
  menitMasukJadwal = 0;
  menitPulangJadwal = 0;
  /** Karyawan bulanan: hari ini memakai jatah libur (tidak masuk, atau izin/sakit yang mengurangi jatah). */
  pakaiJatah = false;
  /** Urutan libur dalam periode gaji (1, 2, …) dan jatah periode itu. */
  liburKe = 0;
  jatahLibur = 0;

  constructor(public karyawan: KaryawanAbsen, public tanggal: Tgl, public status: StatusHari = 'alpa') {}

  /** Mis. "Libur (1/2)", "Libur lebih (3/2)", "Izin · libur 1/2". */
  label(): string {
    const label = LABEL_STATUS[this.status] ?? this.status;
    if (!this.liburKe) return label;
    return this.status === 'libur_jatah' || this.status === 'libur_lebih'
      ? `${label} (${this.liburKe}/${this.jatahLibur})`
      : `${label} · libur ${this.liburKe}/${this.jatahLibur}`;
  }

  melebihiJatah() {
    return this.liburKe > this.jatahLibur;
  }

  warna(): Warna {
    if (this.liburKe && this.melebihiJatah()) return 'bad';
    return WARNA_STATUS[this.status] ?? 'muted';
  }

  hadir() {
    return this.status === 'hadir' || this.status === 'telat' || this.status === 'masuk_libur';
  }

  tambahCatatan(teks: string) {
    this.catatan = this.catatan ? `${this.catatan}; ${teks}` : teks;
  }
}

export class RekapKaryawan {
  hari: HariAbsen[] = [];
  hariKerja = 0;
  hadir = 0;
  tepatWaktu = 0;
  telat = 0;
  telatMenit = 0;
  pulangCepat = 0;
  pulangCepatMenit = 0;
  lupaPulang = 0;
  sakit = 0;
  izin = 0;
  cuti = 0;
  dinas = 0;
  alpa = 0;
  masukLibur = 0;
  durasiMenit = 0;
  lemburMenit = 0;
  /** Karyawan bulanan: jatah libur periode gaji berjalan (null = tidak memakai jatah libur). */
  jatahLibur: number | null = null;
  /** Libur terpakai sejak awal periode gaji berjalan sampai hari ini / akhir rentang. */
  liburTerpakai = 0;
  /** Hari dalam rentang berstatus libur yang masih dalam jatah (tidak mengurangi persentase hadir). */
  liburDalamJatah = 0;
  periodeJatah: [Tgl, Tgl] | null = null;
  /** Hari yang memakai jatah dalam periode gaji berjalan, urut tanggal. */
  tanggalLibur: HariAbsen[] = [];

  constructor(public karyawan: KaryawanAbsen) {}

  liburLebih() {
    return this.jatahLibur === null ? 0 : Math.max(0, this.liburTerpakai - this.jatahLibur);
  }

  sisaJatah() {
    return this.jatahLibur === null ? 0 : Math.max(0, this.jatahLibur - this.liburTerpakai);
  }

  /** Persentase kehadiran; cuti, dinas luar, dan libur dalam jatah tidak mengurangi persentase. */
  persenHadir(): number | null {
    const dasar = this.hariKerja - this.cuti - this.dinas - this.liburDalamJatah;
    if (dasar <= 0) return null;
    return Math.round((100 * Math.min(this.hadir - this.masukLibur, dasar)) / dasar);
  }
}

/** Menentukan jam masuk & pulang dari scan satu hari (urut waktu). */
export function tentukanMasukPulang(scans: ScanAbsen[], jarakMinimal: number): [string | null, string | null] {
  if (!scans.length) return [null, null];
  const jam = (s: ScanAbsen) => s.waktuScan.slice(11, 19);
  const detik = (s: ScanAbsen) => keMenit(jam(s)) * 60 + +jam(s).slice(6, 8);
  const masukK = scans.filter((s) => s.statusScan !== null && STATUS_MASUK.includes(s.statusScan));
  const pulangK = scans.filter((s) => s.statusScan !== null && STATUS_PULANG.includes(s.statusScan));

  let masuk: ScanAbsen | null = null;
  let pulang: ScanAbsen | null = null;
  if (pulangK.length) {
    pulang = pulangK[pulangK.length - 1];
    if (masukK.length) masuk = masukK[0];
    else if (detik(scans[0]) < detik(pulang) - jarakMinimal * 60) masuk = scans[0];
    if (masuk && detik(pulang) <= detik(masuk)) masuk = pulang = null; // status tidak masuk akal, pakai urutan waktu
  }
  if (!masuk && !pulang) {
    const pertama = scans[0];
    const terakhir = scans[scans.length - 1];
    masuk = pertama;
    if (Math.floor((detik(terakhir) - detik(pertama)) / 60) >= jarakMinimal) pulang = terakhir;
  }
  return [masuk ? jam(masuk) : null, pulang ? jam(pulang) : null];
}

export class Perhitungan {
  readonly mulai: Tgl;
  readonly selesai: Tgl;
  readonly jadwalHarian: JadwalHarian;
  /** Periode gaji yang mencakup rentang (untuk jatah libur). */
  readonly periodeJatah: [Tgl, Tgl][];
  /** Data dimuat sejak awal periode gaji pertama, supaya urutan libur dalam periode tetap benar. */
  readonly awalData: Tgl;
  private scan = new Map<string, ScanAbsen[]>();
  private izin = new Map<number, IzinAbsen[]>();
  private koreksi = new Map<string, KoreksiAbsen>();

  constructor(public data: DataAbsensi) {
    this.mulai = data.mulai;
    this.selesai = data.selesai;
    this.periodeJatah = data.satuPeriode
      ? [[data.mulai, data.selesai]]
      : daftarPeriode(data.mulai, data.selesai, data.periodeGaji, data.aturan.tanggalTutupBuku);
    this.awalData = minTgl(this.mulai, this.periodeJatah[0][0]);
    this.jadwalHarian = new JadwalHarian(data.shift, data.jadwalKhusus, data.jadwal, data.libur);
    for (const s of [...data.scan].sort((a, b) => a.waktuScan.localeCompare(b.waktuScan))) {
      const kunci = `${s.pin}|${s.waktuScan.slice(0, 10)}`;
      (this.scan.get(kunci) ?? this.scan.set(kunci, []).get(kunci)!).push(s);
    }
    for (const iz of data.izin) (this.izin.get(iz.karyawanId) ?? this.izin.set(iz.karyawanId, []).get(iz.karyawanId)!).push(iz);
    for (const k of data.koreksi) this.koreksi.set(`${k.karyawanId}|${k.tanggal}`, k);
  }

  get karyawan() {
    return this.data.karyawan;
  }

  private periodeUntuk(tgl: Tgl): [Tgl, Tgl] {
    return this.periodeJatah.find(([m, s]) => tgl >= m && tgl <= s) ?? [tgl, this.selesai];
  }

  hitungHari(k: KaryawanAbsen, key: Tgl): HariAbsen {
    const hari = new HariAbsen(k, key);
    if ((k.tanggalMasuk && key < k.tanggalMasuk) || (k.tanggalKeluar && key > k.tanggalKeluar)) {
      hari.status = 'luar_masa_kerja';
      return hari;
    }

    const scans = this.scan.get(`${k.pin}|${key}`) ?? [];
    hari.jumlahScan = scans.length;
    let [masuk, pulang] = tentukanMasukPulang(scans, this.data.jadwal.jarakMinimalPulangMenit);

    const kor = this.koreksi.get(`${k.id}|${key}`);
    if (kor) {
      hari.dikoreksi = true;
      masuk = kor.jamMasuk || masuk;
      pulang = kor.jamPulang || pulang;
      hari.catatan = `Koreksi: ${kor.alasan}`;
    }
    hari.jamMasuk = masuk;
    hari.jamPulang = pulang;

    const izin = (this.izin.get(k.id) ?? []).find((iz) => iz.tanggalMulai <= key && iz.tanggalSelesai >= key);
    const jd = this.jadwalHarian.untuk(k, key, masuk ? keMenit(masuk) : null);
    hari.shiftKode = jd.shift?.kode ?? null;
    hari.shiftNama = jd.shift?.nama ?? null;
    hari.shiftWarna = jd.shift?.warna ?? null;
    hari.shiftDitebak = jd.ditebak;
    hari.shiftDitukar = jd.ditukar;
    hari.menitMasukJadwal = jd.masuk;
    hari.menitPulangJadwal = jd.pulang;
    hari.hariKerja = jd.hariKerja;
    const bulanan = pakaiJatahLibur(k);
    if (bulanan && !jd.hariKerja && jd.sebabLibur !== 'nasional') {
      hari.hariKerja = true; // libur per tanggal di Jadwal shift = libur pilihan, memakai jatah
    }
    const adaKehadiran = Boolean(masuk || pulang);
    const { tanggal: hariIni, jam } = this.data.sekarang;
    const menitSekarang = keMenit(jam);

    if (!hari.hariKerja) {
      hari.status = adaKehadiran ? 'masuk_libur' : 'libur';
      if (bulanan && !adaKehadiran && this.data.aturan.liburNasionalKurangiJatah && key <= hariIni) {
        hari.status = 'libur_jatah';
        hari.pakaiJatah = true;
      }
      if (jd.liburKet) hari.tambahCatatan(jd.liburKet);
    } else if (adaKehadiran) {
      hari.status = 'hadir';
      if (masuk && keMenit(masuk) - jd.masuk > jd.toleransi) {
        hari.status = 'telat';
        hari.telatMenit = keMenit(masuk) - jd.masuk;
      }
      if (pulang && jd.pulang - keMenit(pulang) > 0) hari.pulangCepatMenit = jd.pulang - keMenit(pulang);
      if (izin) {
        const teks = `Ada ${(JENIS_IZIN[izin.jenis] ?? izin.jenis).toLowerCase()}: ${izin.keterangan ?? ''}`.trim();
        hari.tambahCatatan(teks.replace(/[:\s]+$/, ''));
      }
    } else if (izin) {
      hari.status = izin.jenis as StatusHari;
      hari.catatan = izin.keterangan ?? '';
      hari.pakaiJatah = bulanan && izin.kurangiJatah && !IZIN_TANPA_JATAH.includes(izin.jenis);
    } else if (key > hariIni || (key === hariIni && menitSekarang < jd.masuk)) {
      hari.status = 'belum_mulai'; // jam masuk shift belum tiba
    } else if (key === hariIni && menitSekarang < jd.pulang) {
      hari.status = 'belum_hadir';
    } else if (bulanan) {
      hari.status = 'libur_jatah'; // jadi libur_lebih di rekap() jika melebihi jatah
      hari.pakaiJatah = true;
      if (jd.liburKet) hari.tambahCatatan(jd.liburKet);
    } else {
      hari.status = 'alpa';
    }

    if (masuk && pulang) {
      hari.durasiMenit = Math.max(0, keMenit(pulang) - keMenit(masuk));
      if (hari.status === 'masuk_libur') hari.lemburMenit = hari.durasiMenit;
      else if (hari.hariKerja) hari.lemburMenit = Math.max(0, keMenit(pulang) - Math.max(jd.pulang, keMenit(masuk)));
    }
    if (masuk && !pulang && key < hariIni) hari.lupaPulang = true;
    if (pulang && !masuk) hari.tanpaScanMasuk = true;
    return hari;
  }

  rekap(): RekapKaryawan[] {
    const batas = minTgl(this.selesai, this.data.sekarang.tanggal);
    return this.karyawan.map((k) => {
      const r = new RekapKaryawan(k);
      const bulanan = pakaiJatahLibur(k);
      // karyawan bulanan dihitung sejak awal periode gaji supaya urutan libur ke-n benar
      for (let d = bulanan ? this.awalData : this.mulai; d <= batas; d = tambahHari(d, 1)) {
        const h = this.hitungHari(k, d);
        if (bulanan) {
          if (!r.periodeJatah || d > r.periodeJatah[1]) mulaiPeriodeJatah(r, this.periodeUntuk(d));
          catatLibur(r, h);
        }
        if (d < this.mulai) continue;
        r.hari.push(h);
        // hari yang belum selesai (belum hadir) tidak dihitung sebagai hari kerja
        if (h.status === 'luar_masa_kerja' || h.status === 'belum_hadir' || h.status === 'belum_mulai') continue;
        if (h.hariKerja) r.hariKerja++;
        if (h.hadir()) r.hadir++;
        switch (h.status) {
          case 'hadir': r.tepatWaktu++; break;
          case 'telat': r.telat++; r.telatMenit += h.telatMenit; break;
          case 'sakit': r.sakit++; break;
          case 'izin': r.izin++; break;
          case 'cuti': r.cuti++; break;
          case 'dinas': r.dinas++; break;
          case 'alpa': r.alpa++; break;
          case 'masuk_libur': r.masukLibur++; break;
          case 'libur_jatah': if (h.hariKerja) r.liburDalamJatah++; break;
        }
        if (h.pulangCepatMenit) { r.pulangCepat++; r.pulangCepatMenit += h.pulangCepatMenit; }
        if (h.lupaPulang) r.lupaPulang++;
        r.durasiMenit += h.durasiMenit;
        r.lemburMenit += h.lemburMenit;
      }
      return r;
    });
  }
}

/** Karyawan aktif, atau yang keluar setelah tanggal tertentu (agar tetap muncul di rekap). */
export const terhitungSejak = (k: Pick<KaryawanAbsen, 'aktif' | 'tanggalKeluar'>, mulai: Tgl) =>
  k.aktif || (k.tanggalKeluar !== null && k.tanggalKeluar >= mulai);
