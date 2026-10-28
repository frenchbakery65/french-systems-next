/** Port dari tests/Feature/JatahLiburTest.php (bagian absensi; bagian gaji menyusul di Tahap 3). */
import { beforeEach, describe, expect, it } from 'vitest';
import { jatahPeriode } from '@/lib/absensi/jatah-libur';
import { Dunia } from './bantu';

describe('jatah libur karyawan bulanan', () => {
  let w: Dunia;
  beforeEach(() => {
    w = new Dunia('2026-10-05 10:00:00');
    w.periodeGaji.push({ nama: 'September 2026', tanggalMulai: '2026-09-01', tanggalSelesai: '2026-09-30' });
  });
  const bulanan = (lain = {}) => w.tambah({ jenisPekerja: 'Bulanan', gajiPokok: 2_700_000, shiftId: 4, ...lain });

  it('libur hari apa saja berurutan per tanggal', () => {
    const k = bulanan();
    w.masukSemua(k, '2026-09-01', '2026-09-30', ['2026-09-08', '2026-09-12', '2026-09-14']); // Selasa, Sabtu, Senin
    const h = w.hariRekap(k, '2026-09-01', '2026-09-30');
    expect(['2026-09-08', '2026-09-12', '2026-09-14'].map((t) => h[t].status)).toEqual(['libur_jatah', 'libur_jatah', 'libur_lebih']);
    expect(['2026-09-08', '2026-09-12', '2026-09-14'].map((t) => h[t].label())).toEqual(['Libur (1/2)', 'Libur (2/2)', 'Libur lebih (3/2)']);
    expect([h['2026-09-12'].warna(), h['2026-09-14'].warna()]).toEqual(['muted', 'bad']);
    expect([h['2026-09-13'].status, h['2026-09-13'].lemburMenit]).toEqual(['hadir', 0]); // Minggu = hari kerja biasa

    // libur pilihan lewat Jadwal shift juga memakai jatah; libur rutin mingguan diabaikan
    const k2 = bulanan({ hariLiburMingguan: [0] });
    w.masukSemua(k2, '2026-09-01', '2026-09-30', ['2026-09-08']);
    w.jadwalKhusus.push({ karyawanId: k2.id, tanggal: '2026-09-08', shiftId: null, libur: true });
    const h2 = w.hariRekap(k2, '2026-09-01', '2026-09-30');
    expect([h2['2026-09-08'].status, h2['2026-09-08'].liburKe, h2['2026-09-06'].status]).toEqual(['libur_jatah', 1, 'hadir']);

    // rekap rentang lain tetap menghitung jatah periode gaji
    const r = w.hitung('2026-09-13', '2026-09-20', k).rekap()[0];
    expect([r.jatahLibur, r.liburTerpakai, r.liburLebih(), r.sisaJatah()]).toEqual([2, 3, 1, 0]);
    expect(r.hari.find((x) => x.tanggal === '2026-09-14')!.status).toBe('libur_lebih');
  });

  it('tidak scan pulang tetap hadir dan tidak memakai jatah', () => {
    const k = bulanan();
    w.masukSemua(k, '2026-09-01', '2026-09-30', ['2026-09-10']);
    w.scan = w.scan.filter((s) => !(s.pin === k.pin && s.waktuScan === '2026-09-11 17:00:00'));
    const r = w.hitung('2026-09-01', '2026-09-30', k).rekap()[0];
    const h = r.hari.find((x) => x.tanggal === '2026-09-11')!;
    expect([h.status, h.lupaPulang, h.liburKe]).toEqual(['hadir', true, 0]);
    expect(r.liburTerpakai).toBe(1);
  });

  it('libur nasional tidak mengurangi jatah (kecuali diatur)', () => {
    w.libur['2026-09-17'] = 'Libur nasional';
    const k = bulanan();
    w.masukSemua(k, '2026-09-01', '2026-09-30', ['2026-09-17', '2026-09-03', '2026-09-04']);
    let r = w.hitung('2026-09-01', '2026-09-30', k, true).rekap()[0];
    const h = r.hari.find((x) => x.tanggal === '2026-09-17')!;
    expect([h.status, h.hariKerja, h.liburKe]).toEqual(['libur', false, 0]);
    expect([r.liburTerpakai, r.liburLebih(), r.hariKerja]).toEqual([2, 0, 29]);

    w.aturan.liburNasionalKurangiJatah = true;
    r = w.hitung('2026-09-01', '2026-09-30', k, true).rekap()[0];
    expect([r.liburTerpakai, r.liburLebih()]).toEqual([3, 1]);
  });

  it('izin mengurangi jatah jika dicentang, cuti tidak pernah', () => {
    const k = bulanan();
    w.masukSemua(k, '2026-09-01', '2026-09-30', ['2026-09-08', '2026-09-09', '2026-09-10']);
    w.izin.push({ karyawanId: k.id, jenis: 'izin', kurangiJatah: true, tanggalMulai: '2026-09-08', tanggalSelesai: '2026-09-08', keterangan: 'urusan keluarga' });
    w.izin.push({ karyawanId: k.id, jenis: 'cuti', kurangiJatah: false, tanggalMulai: '2026-09-09', tanggalSelesai: '2026-09-09', keterangan: null });
    w.izin.push({ karyawanId: k.id, jenis: 'sakit', kurangiJatah: false, tanggalMulai: '2026-09-10', tanggalSelesai: '2026-09-10', keterangan: null });
    const r = w.hitung('2026-09-01', '2026-09-30', k).rekap()[0];
    const h = Object.fromEntries(r.hari.map((x) => [x.tanggal, x]));
    expect([h['2026-09-08'].status, h['2026-09-08'].label()]).toEqual(['izin', 'Izin · libur 1/2']);
    expect([h['2026-09-09'].liburKe, h['2026-09-10'].liburKe]).toEqual([0, 0]);
    expect([r.liburTerpakai, r.cuti, r.sakit, r.izin]).toEqual([1, 1, 1, 1]);
  });

  it('masuk tengah periode: jatah prorata dan koreksi mengurangi libur', () => {
    const k = bulanan({ tanggalMasuk: '2026-09-16' }); // aktif 15 dari 30 hari → jatah 1
    expect(jatahPeriode(k, '2026-09-01', '2026-09-30')).toBe(1);
    w.masukSemua(k, '2026-09-16', '2026-09-30', ['2026-09-18', '2026-09-25']);
    let r = w.hitung('2026-09-01', '2026-09-30', k, true).rekap()[0];
    expect([r.jatahLibur, r.liburTerpakai, r.liburLebih()]).toEqual([1, 2, 1]);
    w.koreksi.push({ karyawanId: k.id, tanggal: '2026-09-25', jamMasuk: '08:00:00', jamPulang: '17:00:00', alasan: 'lupa scan' });
    r = w.hitung('2026-09-01', '2026-09-30', k, true).rekap()[0];
    expect([r.liburTerpakai, r.liburLebih()]).toEqual([1, 0]);
  });

  it('tabel contoh: libur per periode 29/30/31 hari', () => {
    w.sekarang = '2026-12-05 10:00:00';
    w.periodeGaji.push({ nama: 'Oktober 2026', tanggalMulai: '2026-10-01', tanggalSelesai: '2026-10-31' });
    w.periodeGaji.push({ nama: 'November 2026', tanggalMulai: '2026-11-01', tanggalSelesai: '2026-11-29' });
    const a = bulanan();
    const b = bulanan();
    w.masukSemua(a, '2026-09-01', '2026-11-29', ['2026-09-05', '2026-09-06', '2026-10-05', '2026-10-06', '2026-11-05', '2026-11-06']);
    w.masukSemua(b, '2026-09-01', '2026-10-31', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-20', '2026-10-01', '2026-10-15', '2026-10-31']);
    const cek = (k: typeof a, m: string, s: string) => {
      const r = w.hitung(m, s, k, true).rekap()[0];
      return [r.liburTerpakai, r.liburLebih()];
    };
    expect(cek(a, '2026-11-01', '2026-11-29')).toEqual([2, 0]);
    expect(cek(a, '2026-09-01', '2026-09-30')).toEqual([2, 0]);
    expect(cek(a, '2026-10-01', '2026-10-31')).toEqual([2, 0]);
    expect(cek(b, '2026-10-01', '2026-10-31')).toEqual([3, 1]);
    expect(cek(b, '2026-09-01', '2026-09-30')).toEqual([5, 3]);
  });

  it('karyawan harian tidak terpengaruh', () => {
    const k = w.tambah({ jenisPekerja: 'Harian', hariLiburMingguan: [0, 6] });
    w.masukSemua(k, '2026-09-01', '2026-09-30', ['2026-09-02', '2026-09-03', '2026-09-04']);
    const r = w.hitung('2026-09-01', '2026-09-30', k).rekap()[0];
    expect([r.alpa, r.jatahLibur, r.liburTerpakai, r.hariKerja]).toEqual([3, null, 0, 22]);
    expect(r.hari.find((x) => x.tanggal === '2026-09-02')!.status).toBe('alpa');
  });
});
