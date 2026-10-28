/** Port dari tests/Feature/ShiftTest.php (bagian perhitungan). */
import { beforeEach, describe, expect, it } from 'vitest';
import { Dunia, idShift } from './bantu';

describe('shift', () => {
  let w: Dunia;
  beforeEach(() => { w = new Dunia('2026-09-30 22:00:00'); }); // Rabu
  const k = (kode: string | null, lain = {}) => w.tambah({ shiftId: kode ? idShift(kode) : null, jenisPekerja: 'Harian', ...lain });
  const scan = (x: ReturnType<typeof k>, tgl: string, ...jam: string[]) => jam.forEach((j) => w.log(x, `${tgl} ${j}`));

  it('shift siang tepat waktu tanpa lembur', () => {
    const a = k('SIANG');
    scan(a, '2026-09-29', '12:03:00', '21:00:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.telatMenit, h.lemburMenit, h.pulangCepatMenit, h.shiftKode]).toEqual(['hadir', 0, 0, 0, 'SIANG']);
  });

  it('shift siang telat dihitung dari jam shift', () => {
    const a = k('SIANG');
    scan(a, '2026-09-29', '12:20:00', '21:00:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.telatMenit]).toEqual(['telat', 20]);
  });

  it('shift subuh pulang dan lembur', () => {
    const a = k('SUBUH');
    scan(a, '2026-09-28', '05:30:00', '14:30:00');
    scan(a, '2026-09-29', '05:30:00', '16:30:00');
    const h = w.hari(a, '2026-09-28');
    expect([h.status, h.pulangCepatMenit, h.lemburMenit]).toEqual(['hadir', 0, 0]);
    expect(w.hari(a, '2026-09-29').lemburMenit).toBe(120);
  });

  it('tukar shift dan libur per tanggal', () => {
    const a = k('NORMAL');
    w.jadwalKhusus.push({ karyawanId: a.id, tanggal: '2026-09-29', shiftId: idShift('SIANG'), libur: false });
    w.jadwalKhusus.push({ karyawanId: a.id, tanggal: '2026-09-30', shiftId: null, libur: true });
    scan(a, '2026-09-29', '12:03:00', '21:00:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.telatMenit, h.shiftKode, h.shiftDitukar]).toEqual(['hadir', 0, 'SIANG', true]);
    const libur = w.hari(a, '2026-09-30');
    expect([libur.status, libur.hariKerja]).toEqual(['libur', false]);
    w.jadwalKhusus.shift(); // kembali ke bawaan
    expect([w.hari(a, '2026-09-29').status, w.hari(a, '2026-09-29').shiftKode]).toEqual(['telat', 'NORMAL']);
  });

  it('libur rutin per karyawan', () => {
    const a = k('NORMAL', { hariLiburMingguan: [3] }); // libur tiap Rabu
    expect(w.hari(a, '2026-09-23').status).toBe('libur');
    scan(a, '2026-09-30', '08:00:00', '12:00:00');
    const h = w.hari(a, '2026-09-30');
    expect([h.status, h.lemburMenit]).toEqual(['masuk_libur', 240]);
    expect(w.hari(a, '2026-09-26').status).toBe('alpa'); // Sabtu tetap hari kerja
  });

  it('tanpa shift ditebak dari scan pertama', () => {
    const a = k(null);
    scan(a, '2026-09-29', '06:05:00', '15:00:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.shiftKode, h.shiftDitebak, h.status]).toEqual(['TOKO-06', true, 'hadir']);
    const t = w.hari(a, '2026-09-28');
    expect([t.shiftKode, t.shiftDitebak, t.status]).toEqual([null, false, 'alpa']);
  });

  it('shift bawaan tidak ditimpa tebakan', () => {
    const a = k('TOKO-06');
    scan(a, '2026-09-29', '08:05:00', '15:00:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.shiftKode, h.shiftDitebak, h.status, h.telatMenit]).toEqual(['TOKO-06', false, 'telat', 125]);
  });

  it('shift siang belum mulai pukul sembilan', () => {
    w.sekarang = '2026-09-30 09:00:00';
    const a = k('SIANG');
    const b = k('NORMAL');
    expect(w.hari(a, '2026-09-30').status).toBe('belum_mulai');
    expect(w.hari(b, '2026-09-30').status).toBe('belum_hadir');
  });

  it('scan jauh sebelum jam masuk shift tidak dihitung tepat waktu', () => {
    const a = k('SIANG');
    scan(a, '2026-09-29', '00:26:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.jamMasuk, h.scanDiabaikan]).toEqual(['alpa', null, ['00:26:00']]);
    expect(h.catatan).toContain('Scan 00:26 di luar jam shift');
  });

  it('scan dini hari diabaikan, masuk & pulang dari scan berikutnya', () => {
    const a = k('SIANG');
    scan(a, '2026-09-29', '00:26:00', '12:20:00', '21:00:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.jamMasuk, h.jamPulang, h.telatMenit, h.durasiMenit]).toEqual(['telat', '12:20:00', '21:00:00', 20, 520]);
  });

  it('datang awal masih dalam batas tetap dihitung', () => {
    const a = k('SUBUH');
    scan(a, '2026-09-29', '03:00:00', '14:30:00');
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.jamMasuk, h.scanDiabaikan]).toEqual(['hadir', '03:00:00', []]);
  });

  it('koreksi menimpa scan di luar jam shift tanpa catatan', () => {
    const a = k('SIANG');
    scan(a, '2026-09-29', '00:26:00');
    w.koreksi.push({ karyawanId: a.id, tanggal: '2026-09-29', jamMasuk: '12:00:00', jamPulang: '21:00:00', alasan: 'lupa scan' });
    const h = w.hari(a, '2026-09-29');
    expect([h.status, h.jamMasuk, h.catatan]).toEqual(['hadir', '12:00:00', 'Koreksi: lupa scan']);
  });
});
