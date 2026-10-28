/** Port dari GajiTest, GajiUpahHarianTest, JatahLiburTest (bagian gaji), dan RekapGajiTest. */
import { beforeEach, describe, expect, it } from 'vitest';
import { hitungSlip, hitungTotal, jamLembur, keteranganTelat, MANUAL_KOSONG, type AturanGaji, type KaryawanGaji, type Manual } from '@/lib/gaji/hitung';
import { baris, judulPeriode, periksa, selTotal, susun, total, LABEL_TOTAL } from '@/lib/gaji/rekap';
import type { KaryawanAbsen } from '@/lib/absensi/tipe';
import { tambahHari } from '@/lib/tanggal';
import { Dunia } from './bantu';

const ATURAN: AturanGaji = {
  tanggalTutupBuku: 29, liburNasionalKurangiJatah: false, hariPerBulan: 30, jamKerjaPerHari: 9, metodePotonganTelat: 'per_jam',
  potonganTelatPerKali: 2500, telatMinimalMenit: 60, telatPembulatanMenit: 60, potonganAlpaPerHari: 0, lemburOtomatis: true,
  lemburMinimalMenit: 60, lemburPembulatanMenit: 60, premiHangusJikaAlpa: true, premiMaksTelat: null, prorataGajiPokok: true, mulaiPakai: null,
};

const gajiK = (k: KaryawanAbsen, lain: Partial<KaryawanGaji> = {}): KaryawanGaji =>
  Object.assign(k, { jabatan: null, tarifLemburPerJam: 0, uangMakan: 0, uangMakanPerHari: false, tunjanganPrestasi: 0, premiHadir: 0, ...lain });

function slip(w: Dunia, k: KaryawanGaji, mulai: string, selesai: string, aturan: Partial<AturanGaji> = {}, manual: Partial<Manual> = {}) {
  const a = { ...ATURAN, ...aturan };
  w.aturan = a;
  const r = w.hitung(mulai, selesai, k, true).rekap()[0];
  return hitungSlip(k, r, { mulai, selesai, aturan: a, jadwal: w.hitung(mulai, mulai, k).data.jadwal, libur: w.libur }, { ...MANUAL_KOSONG, ...manual });
}

describe('slip contoh kertas (Rebecca, Kontrak)', () => {
  let w: Dunia;
  let k: KaryawanGaji;
  beforeEach(() => {
    w = new Dunia('2026-09-30 10:00:00');
    k = gajiK(w.tambah({ pin: '5005', nama: 'Rebecca R. Siburian', jenisPekerja: 'Kontrak', gajiPokok: 750000 }),
      { tarifLemburPerJam: 75000, uangMakan: 150000, tunjanganPrestasi: 350000, premiHadir: 150000, jabatan: 'SPG_TOKO' });
    // Hadir semua hari kerja; satu hari telat; dua hari pulang jam 19:00 (lembur 2 jam)
    let no = 0;
    for (let d = '2026-08-30'; d <= '2026-09-29'; d = tambahHari(d, 1)) {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      no++;
      w.log(k, `${d} ${no === 3 ? '08:10:00' : '07:50:00'}`, 0);
      w.log(k, `${d} ${[5, 10].includes(no) ? '19:00:00' : '17:02:00'}`, 1);
    }
  });

  it('angka sama dengan slip contoh', () => {
    const s = slip(w, k, '2026-08-30', '2026-09-29', { metodePotonganTelat: 'per_kali' }, { bonus: 400000, potKasbon: 500000 });
    expect([s.telat, jamLembur(s), s.upahLembur, s.subtotalGaji, s.totalPenerimaan, s.totalKotor, s.potTelat, s.totalPotongan, s.gajiBersih])
      .toEqual([1, 4, 300000, 1050000, 1050000, 2100000, 2500, 502500, 1597500]);
  });

  it('jam lembur manual menimpa otomatis', () => {
    const s = slip(w, k, '2026-08-30', '2026-09-29', {}, { bonus: 400000, jamLemburManual: 1.5 });
    expect([s.bonus, jamLembur(s), s.upahLembur]).toEqual([400000, 1.5, 112500]);
  });

  it('karyawan harian tidak dapat premi hadir', () => {
    k.jenisPekerja = 'Harian';
    expect(slip(w, k, '2026-08-30', '2026-09-29').premiHadir).toBe(0);
  });
});

describe('premi hangus, potongan tidak hadir, uang makan per hari, prorata harian', () => {
  it('premi hangus & potongan alpa (Kontrak)', () => {
    const w = new Dunia('2026-09-30 10:00:00');
    const k = gajiK(w.tambah({ jenisPekerja: 'Kontrak', gajiPokok: 750000 }), { premiHadir: 150000 });
    w.log(k, '2026-09-01 07:50:00'); w.log(k, '2026-09-01 17:00:00');
    const s = slip(w, k, '2026-08-30', '2026-09-29', { potonganAlpaPerHari: 25000 });
    expect(s.alpa).toBeGreaterThan(0);
    expect([s.premiHadir, s.potAlpa]).toEqual([0, s.alpa * 25000]);
    expect(s.catatanHitung).toContain('Premi hadir hangus');
  });

  it('uang makan per hari dan prorata menurut hari kerja', () => {
    const w = new Dunia('2026-09-30 10:00:00');
    const k = gajiK(w.tambah({ jenisPekerja: 'Kontrak', gajiPokok: 750000, tanggalMasuk: '2026-09-15' }), { uangMakan: 10000, uangMakanPerHari: true });
    w.log(k, '2026-09-15 07:50:00'); w.log(k, '2026-09-15 17:00:00');
    const s = slip(w, k, '2026-08-30', '2026-09-29');
    expect(s.uangMakan).toBe(10000);
    expect(s.gajiPokok).toBe(Math.round((750000 * 11) / 22)); // 15–29 Sep = 11 dari 22 hari kerja
    expect(s.catatanHitung).toContain('Gaji pokok prorata 11/22 hari kerja');
  });
});

describe('upah harian, telat sebulan, lembur per jam', () => {
  let w: Dunia;
  let k: KaryawanGaji;
  beforeEach(() => {
    w = new Dunia('2026-09-30 10:00:00');
    k = gajiK(w.tambah({ pin: '7', jenisPekerja: 'Bulanan', gajiPokok: 2700000, upahHarian: 90000, shiftId: 4 }));
  });
  const absen = (tgl: string, masuk: string, pulang = '17:02:00') => { w.log(k, `${tgl} ${masuk}`, 0); w.log(k, `${tgl} ${pulang}`, 1); };
  const s = (a: Partial<AturanGaji> = {}) => slip(w, k, '2026-08-30', '2026-09-29', a);

  it('telat dijumlah sebulan × upah per jam', () => {
    absen('2026-09-01', '08:30:00'); absen('2026-09-02', '09:30:00');
    const x = s();
    expect([x.upahHarian, x.upahPerJam, x.telat, x.menitTelat, x.menitTelatDipotong, x.potTelat]).toEqual([90000, 10000, 2, 120, 120, 20000]);
    expect(keteranganTelat(x)).toBe('telat 2 jam, dipotong 2 jam × 10.000/jam');
  });

  it('telat di bawah batas tidak dipotong', () => {
    absen('2026-09-01', '08:20:00'); absen('2026-09-02', '08:25:00');
    const x = s();
    expect([x.menitTelat, x.menitTelatDipotong, x.potTelat]).toEqual([45, 0, 0]);
    expect(x.catatanHitung).toContain('Telat 45 mnt belum mencapai 1 jam, tidak dipotong');
    expect(keteranganTelat(x)).toBe('telat 45 mnt (di bawah batas)');
  });

  it('telat dibulatkan ke bawah per jam', () => {
    absen('2026-09-01', '10:40:00');
    expect([s().menitTelat, s().menitTelatDipotong, s().potTelat]).toEqual([160, 120, 20000]);
  });

  it('lembur pakai upah per jam jika tarif khusus kosong', () => {
    absen('2026-09-01', '07:50:00', '20:00:00');
    expect([jamLembur(s()), s().tarifLembur, s().upahLembur]).toEqual([3, 10000, 30000]);
    k.tarifLemburPerJam = 15000;
    expect(s().upahLembur).toBe(45000);
  });

  it('upah harian kosong dihitung dari gaji pokok', () => {
    k.upahHarian = 0;
    const x = s();
    expect([x.upahHarian, x.upahPerJam]).toEqual([90000, 10000]);
    expect(x.catatanHitung).toContain('Upah harian dari gaji pokok ÷ 30 hari = 90.000');
  });

  it('metode per kali', () => {
    absen('2026-09-01', '08:30:00'); absen('2026-09-02', '09:30:00');
    const x = s({ metodePotonganTelat: 'per_kali' });
    expect([x.telat, x.menitTelatDipotong, x.potTelat]).toEqual([2, 0, 5000]);
    expect(keteranganTelat(x)).toBe('telat 2×');
  });
});

describe('gaji bulanan: jatah libur & dipukul rata 30 hari', () => {
  let w: Dunia;
  beforeEach(() => { w = new Dunia('2026-12-05 10:00:00'); });
  const bulanan = (lain: Partial<KaryawanAbsen> = {}) => gajiK(w.tambah({ jenisPekerja: 'Bulanan', gajiPokok: 2700000, shiftId: 4, ...lain }));

  it('tabel contoh periode 29/30/31 hari: gaji pokok utuh, potongan libur lebih', () => {
    const a = bulanan();
    const b = bulanan();
    const c = bulanan();
    w.masukSemua(a, '2026-09-01', '2026-11-29', ['2026-09-05', '2026-09-06', '2026-10-05', '2026-10-06', '2026-11-05', '2026-11-06']);
    w.masukSemua(b, '2026-09-01', '2026-10-31', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-20', '2026-10-01', '2026-10-15', '2026-10-31']);
    w.masukSemua(c, '2026-09-01', '2026-09-30', ['2026-09-17']);
    const contoh: [KaryawanGaji, string, string, number, number, number, number][] = [
      [a, '2026-11-01', '2026-11-29', 29, 2, 0, 0],
      [a, '2026-09-01', '2026-09-30', 30, 2, 0, 0],
      [a, '2026-10-01', '2026-10-31', 31, 2, 0, 0],
      [c, '2026-09-01', '2026-09-30', 30, 1, 0, 0],
      [b, '2026-10-01', '2026-10-31', 31, 3, 1, 90000],
      [b, '2026-09-01', '2026-09-30', 30, 5, 3, 270000],
    ];
    for (const [k, m, sel, panjang, libur, lebih, potongan] of contoh) {
      const x = slip(w, k, m, sel);
      expect([x.panjangPeriode, x.liburTerpakai, x.liburLebih, x.potAlpa, x.gajiPokok, x.upahHarian], `${m} libur ${libur}`)
        .toEqual([panjang, libur, lebih, potongan, 2700000, 90000]);
      expect(x.gajiBersih).toBe(2700000 - potongan);
    }
    expect(slip(w, b, '2026-10-01', '2026-10-31').catatanHitung).toContain('Libur 3 hari, jatah 2 → dipotong 1 × Rp90.000');
  });

  it('premi hadir bulanan tetap penuh walau libur lebih', () => {
    const k = bulanan();
    k.premiHadir = 150000;
    w.masukSemua(k, '2026-09-01', '2026-09-10');
    const x = slip(w, k, '2026-09-01', '2026-09-30');
    expect([x.premiHadir, x.liburLebih]).toEqual([150000, 18]);
    expect(x.catatanHitung ?? '').not.toContain('Premi hadir hangus');
  });

  it('prorata dipukul rata 30 hari (periode 29/30/31 hari)', () => {
    const g = (lain: Partial<KaryawanAbsen>, m: string, s: string) => slip(w, bulanan(lain), m, s);
    expect(g({ tanggalMasuk: '2026-10-17' }, '2026-10-01', '2026-10-31').gajiPokok).toBe(1350000);
    expect(g({ tanggalMasuk: '2026-10-17' }, '2026-10-01', '2026-10-31').catatanHitung).toContain('Gaji pokok prorata 15/30 hari');
    expect(g({ tanggalMasuk: '2027-02-13' }, '2027-01-30', '2027-02-27').gajiPokok).toBe(1350000);
    expect(g({ tanggalMasuk: '2026-10-02' }, '2026-10-01', '2026-10-31').gajiPokok).toBe(2700000);
    const penuh = g({}, '2026-10-01', '2026-10-31');
    expect([penuh.gajiPokok, (penuh.catatanHitung ?? '').includes('prorata')]).toEqual([2700000, false]);
    expect(g({ tanggalKeluar: '2026-09-10' }, '2026-09-01', '2026-09-30').gajiPokok).toBe(900000);
  });

  it('potongan libur dibatasi sebesar gaji pokok', () => {
    const k = bulanan({ gajiPokok: 300000, upahHarian: 50000 }); // lebih 28 hari × 50.000 > gaji pokok
    const x = slip(w, k, '2026-09-01', '2026-09-30'); // tidak pernah masuk
    expect([x.potAlpa, x.gajiBersih]).toEqual([300000, 0]);
    expect(x.catatanHitung).toContain('dibatasi sebesar gaji pokok');
  });
});

describe('rekap gaji seperti kertas', () => {
  const dasar = { ...MANUAL_KOSONG, departemen: null, jabatan: null, upahHarian: 0, upahPerJam: 0, hariKerja: 26, telat: 0, menitTelat: 0,
    menitTelatDipotong: 0, alpa: 0, izin: 0, panjangPeriode: 31, jatahLibur: 0, liburTerpakai: 0, liburLebih: 0, jamLemburOtomatis: 0,
    tarifLembur: 10000, uangMakan: 0, tunjanganPrestasi: 0, premiHadir: 0, potTelat: 0, potAlpa: 0, catatanHitung: null, jenisPekerja: 'Harian' };
  const buat = (pin: string, nama: string, lain: Record<string, number | string | null>) =>
    ({ ...hitungTotal({ ...dasar, pin, nama, hadir: 0, gajiPokok: 0, ...lain } as Parameters<typeof hitungTotal>[0]), id: Number(pin), karyawanId: Number(pin) });

  it('contoh RUM: 2.300.000 / 542.120 / 1.757.880, urut NIP numerik, bersih = gaji_bersih', () => {
    const rum = buat('12', 'Rum', { gajiPokok: 800000, jamLemburOtomatis: 30, premiHadir: 150000, uangMakan: 150000, tunjanganPrestasi: 450000, bonus: 450000, potKasbon: 500000, potTelat: 42120, hadir: 26 });
    const zaki = buat('101', 'Zaki', { gajiPokok: 2700000, potAlpa: 90000, potPinjaman: 100000, potLain: 25000, komisi: 75000, hadir: 27, alpa: 1 });
    const budi = buat('3', 'Budi', { gajiPokok: 1500000, uangMakan: 200000, pot5: 30000, hadir: 25 });
    const r = susun([rum, zaki, budi]);
    expect(r.karyawan.map((x) => x.slip.nama)).toEqual(['Budi', 'Rum', 'Zaki']);
    expect(total(baris(rum))).toEqual({ penerimaan: 2300000, potongan: 542120, bersih: 1757880 });
    for (const x of r.karyawan) expect(x.total.bersih).toBe(x.slip.gajiBersih);
    expect(r.grand.bersih).toBe(rum.gajiBersih + zaki.gajiBersih + budi.gajiBersih);
    expect(selTotal(total(baris(rum)), LABEL_TOTAL).filter(([, j]) => j).map(([n, j, isi]) => [n, j, isi]))
      .toEqual([[3, 'label', 'TOTAL PENERIMAAN'], [1, 'nilai', 2300000], [2, 'label', 'TOTAL POTONGAN'], [1, 'nilai', 542120], [2, 'label', 'PENERIMAAN BERSIH'], [1, 'nilai', 1757880]]);
    expect(judulPeriode('2026-08-30', '2026-09-29')).toBe('Periode 30/08/2026 – 29/09/2026');
  });

  it('periksa data janggal', () => {
    const nol = { ...buat('1', 'Nol', { hadir: 20, jenisPekerja: 'Bulanan' }), gajiPokokKaryawan: 0 };
    const ketik = { ...buat('2', 'Ketik', { gajiPokok: 123321, hadir: 25, jenisPekerja: 'Bulanan' }), gajiPokokKaryawan: 123321 };
    const jarang = { ...buat('3', 'Jarang', { gajiPokok: 2700000, hadir: 4, jenisPekerja: 'Bulanan' }), gajiPokokKaryawan: 2700000 };
    const normal = { ...buat('4', 'Normal', { gajiPokok: 2700000, hadir: 26 }), gajiPokokKaryawan: 2700000 };
    const c = periksa([nol, ketik, jarang, normal], '2026-08-30', '2026-09-29', '2026-10-12');
    expect([c.gaji0.map((s) => s.nama), c.tidakBulat.map((s) => s.nama), c.jarang.map((s) => s.nama)]).toEqual([['Nol'], ['Ketik'], ['Jarang']]);
  });
});
