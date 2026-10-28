import { describe, expect, it } from 'vitest';
import { rentangFilter } from '@/lib/absensi/filter';
import { rentangPeriode, rentangUntuk } from '@/lib/absensi/periode';
import { parseWaktu } from '@/lib/fingerspot/klien';
import { durasi, formatDurasi, formatMenit, rp } from '@/lib/format';
import { menitTelatDipotong, perkiraanPotonganTelat, upah } from '@/lib/gaji/upah';
import { kurangiBulan, sekarang, tambahHari } from '@/lib/tanggal';

describe('periode gaji (tutup buku 29)', () => {
  it('berurutan tanpa celah dan tanpa tumpang tindih, termasuk Februari & kabisat', () => {
    let sebelum: string | null = null;
    for (let b = '2026-10-01'; b <= '2028-04-01'; b = kurangiBulan(b, -1)) {
      const [m, s] = rentangUntuk(29, b);
      if (sebelum) expect(m, `bulan ${b}`).toBe(tambahHari(sebelum, 1));
      sebelum = s;
    }
    expect(rentangUntuk(29, '2026-10-01')).toEqual(['2026-09-30', '2026-10-29']);
    expect(rentangUntuk(29, '2027-02-01')).toEqual(['2027-01-30', '2027-02-28']);
    expect(rentangUntuk(29, '2027-03-01')).toEqual(['2027-03-01', '2027-03-29']);
    expect(rentangUntuk(29, '2028-02-01')).toEqual(['2028-01-30', '2028-02-29']);
  });

  it('memakai periode yang sudah dibuat, selain itu aturan tutup buku', () => {
    expect(rentangPeriode('2026-10-28', [], 29)).toEqual({ mulai: '2026-09-30', selesai: '2026-10-29', nama: null });
    expect(rentangPeriode('2026-10-30', [], 29)).toEqual({ mulai: '2026-10-30', selesai: '2026-11-29', nama: null });
    const ada = [{ nama: 'Oktober test', tanggalMulai: '2026-10-01', tanggalSelesai: '2026-10-31' }];
    expect(rentangPeriode('2026-10-30', ada, 29)).toEqual({ mulai: '2026-10-01', selesai: '2026-10-31', nama: 'Oktober test' });
  });

  it('filter rekap', () => {
    expect(rentangFilter({}, '2026-10-28')).toEqual(['2026-10-01', '2026-10-31']);
    expect(rentangFilter({ periode: 'bulan_lalu' }, '2026-10-28')).toEqual(['2026-09-01', '2026-09-30']);
    expect(rentangFilter({ periode: 'minggu_ini' }, '2026-10-28')).toEqual(['2026-10-26', '2026-10-28']);
    expect(rentangFilter({ periode: 'kustom', mulai: '2026-10-20', selesai: '2026-10-05' }, '2026-10-28')).toEqual(['2026-10-05', '2026-10-20']);
  });
});

describe('utilitas', () => {
  it('waktu Fingerspot', () => {
    expect(parseWaktu('2026-10-28 07:55:00')).toBe('2026-10-28 07:55:00');
    expect(parseWaktu('2026-10-28 07:55')).toBe('2026-10-28 07:55:00');
    expect(parseWaktu('2026-02-30 07:55')).toBeNull();
    expect(parseWaktu('kemarin')).toBeNull();
  });

  it('jam sekarang di Asia/Jakarta walau server UTC', () => {
    expect(sekarang(new Date('2026-10-28T17:30:00Z'))).toEqual({ tanggal: '2026-10-29', jam: '00:30:00' });
  });

  it('format', () => {
    expect([formatDurasi(0), formatDurasi(485), formatDurasi(45)]).toEqual(['0j', '8j 05m', '45m']);
    expect([formatMenit(0), formatMenit(65), formatMenit(120), formatMenit(6)]).toEqual(['', '1j 5m', '2j', '6m']);
    expect([durasi(0), durasi(45), durasi(60), durasi(105)]).toEqual(['0 mnt', '45 mnt', '1 jam', '1 jam 45 mnt']);
    expect([rp(2300000), rp(90000, true)]).toEqual(['2.300.000', 'Rp 90.000']);
  });

  it('upah & perkiraan potongan telat', () => {
    const a = { hariPerBulan: 30, jamKerjaPerHari: 9, metodePotonganTelat: 'per_jam', potonganTelatPerKali: 2500, telatMinimalMenit: 60, telatPembulatanMenit: 60, tanggalTutupBuku: 29, liburNasionalKurangiJatah: false, mulaiPakai: null };
    expect(upah({ upahHarian: 0, gajiPokok: 2_700_000 }, a)).toEqual([90000, 10000]);
    expect(upah({ upahHarian: 90000, gajiPokok: 0 }, a)).toEqual([90000, 10000]);
    expect([menitTelatDipotong(45, a), menitTelatDipotong(70, a), menitTelatDipotong(125, a)]).toEqual([0, 60, 120]);
    expect(perkiraanPotonganTelat({ upahHarian: 90000, gajiPokok: 0 }, 2, 70, a)).toBe(10000);
    expect(perkiraanPotonganTelat({ upahHarian: 90000, gajiPokok: 0 }, 3, 70, { ...a, metodePotonganTelat: 'per_kali' })).toBe(7500);
  });
});
