/** Port dari tests/Feature/RekapTest.php (sistem lama). */
import { beforeEach, describe, expect, it } from 'vitest';
import { tentukanMasukPulang } from '@/lib/absensi/perhitungan';
import type { KaryawanAbsen } from '@/lib/absensi/tipe';
import { tambahHari } from '@/lib/tanggal';
import { Dunia } from './bantu';

const SENIN = '2026-10-12';
const scans = (data: [string, number][]) =>
  data.map(([j, s]) => ({ pin: '1', waktuScan: `${SENIN} ${j.length === 5 ? `${j}:00` : j}`, statusScan: s }));

describe('tentukanMasukPulang', () => {
  it('tanpa status pakai urutan waktu', () => expect(tentukanMasukPulang(scans([['07:55', 0], ['07:55:30', 0], ['17:05', 0]]), 60)).toEqual(['07:55:00', '17:05:00']));
  it('scan dobel pagi bukan pulang', () => expect(tentukanMasukPulang(scans([['07:55', 0], ['08:10', 0]]), 60)).toEqual(['07:55:00', null]));
  it('pakai status tombol', () => expect(tentukanMasukPulang(scans([['07:50', 0], ['12:00', 0], ['17:10', 1], ['17:12', 0]]), 60)).toEqual(['07:50:00', '17:10:00']));
  it('status terbalik kembali ke urutan waktu', () => expect(tentukanMasukPulang(scans([['07:50', 1], ['17:00', 0]]), 60)).toEqual(['07:50:00', '17:00:00']));
  it('hanya scan pulang', () => expect(tentukanMasukPulang(scans([['17:00', 1]]), 60)).toEqual([null, '17:00:00']));
});

describe('status harian (pekerja harian, jadwal umum 08:00–17:00 Senin–Jumat)', () => {
  let w: Dunia;
  let k: KaryawanAbsen;
  beforeEach(() => {
    w = new Dunia('2026-10-21 12:00:00');
    k = w.tambah({ pin: '1', nama: 'Andi', jenisPekerja: 'Harian' });
  });

  it('tepat waktu dalam toleransi', () => {
    w.log(k, `${SENIN} 08:05`, 0);
    w.log(k, `${SENIN} 17:00`, 1);
    const h = w.hari(k, SENIN);
    expect([h.status, h.durasiMenit]).toEqual(['hadir', 535]);
  });

  it('telat', () => {
    w.log(k, `${SENIN} 08:06`);
    w.log(k, `${SENIN} 17:30`);
    const h = w.hari(k, SENIN);
    expect([h.status, h.telatMenit]).toEqual(['telat', 6]);
  });

  it('pulang cepat dan lupa pulang', () => {
    w.log(k, `${SENIN} 07:59`);
    w.log(k, `${SENIN} 16:30`);
    expect(w.hari(k, SENIN).pulangCepatMenit).toBe(30);
    w.log(k, '2026-10-13 07:59');
    expect(w.hari(k, '2026-10-13').lupaPulang).toBe(true);
  });

  it('alpa, izin, libur', () => {
    expect(w.hari(k, SENIN).status).toBe('alpa');
    w.izin.push({ karyawanId: k.id, jenis: 'sakit', kurangiJatah: false, tanggalMulai: SENIN, tanggalSelesai: SENIN, keterangan: null });
    expect(w.hari(k, SENIN).status).toBe('sakit');
    expect(w.hari(k, '2026-10-11').status).toBe('libur'); // Minggu
    w.libur['2026-10-14'] = 'Libur nasional';
    expect(w.hari(k, '2026-10-14').status).toBe('libur');
    w.log(k, '2026-10-14 09:00');
    expect(w.hari(k, '2026-10-14').status).toBe('masuk_libur');
  });

  it('koreksi menimpa jam mesin', () => {
    w.log(k, `${SENIN} 08:30`);
    w.koreksi.push({ karyawanId: k.id, tanggal: SENIN, jamMasuk: '07:58:00', jamPulang: '17:00:00', alasan: 'Mesin error' });
    const h = w.hari(k, SENIN);
    expect([h.status, h.jamMasuk, h.jamPulang, h.dikoreksi]).toEqual(['hadir', '07:58:00', '17:00:00', true]);
  });

  it('masa kerja', () => {
    k.tanggalMasuk = '2026-10-13';
    expect(w.hari(k, SENIN).status).toBe('luar_masa_kerja');
  });

  it('hari ini belum selesai tidak dihitung alpa', () => {
    w.sekarang = '2026-10-21 09:00:00'; // Rabu, sebelum jam pulang
    expect(w.hari(k, '2026-10-21').status).toBe('belum_hadir');
  });

  it('rekap periode', () => {
    for (let i = 0; i < 5; i++) {
      if (i === 2) continue; // Rabu tidak masuk
      const d = tambahHari(SENIN, i);
      w.log(k, `${d} ${i === 0 ? '08:20' : '07:50'}`);
      w.log(k, `${d} 17:05`);
    }
    const r = w.hitung(SENIN, '2026-10-18').rekap()[0];
    expect([r.hariKerja, r.hadir, r.telat, r.alpa]).toEqual([5, 4, 1, 1]);
    expect(r.persenHadir()).toBe(80);
  });
});
