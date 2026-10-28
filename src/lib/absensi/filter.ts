import { akhirBulan, awalBulan, awalMinggu, kurangiBulan, selisihHari, tambahHari, validTgl, type Tgl } from '../tanggal';

export const PILIHAN_PERIODE = { minggu_ini: 'Minggu ini', bulan_ini: 'Bulan ini', bulan_lalu: 'Bulan lalu', kustom: 'Pilih tanggal' } as const;
export type PilihanPeriode = keyof typeof PILIHAN_PERIODE;

export interface FilterPeriode { periode?: string; mulai?: string; selesai?: string }

/** Rentang dari filter: minggu ini / bulan ini / bulan lalu / tanggal bebas (maks. 370 hari). */
export function rentangFilter(f: FilterPeriode, hariIni: Tgl): [Tgl, Tgl] {
  let [m, s]: [Tgl, Tgl] = (() => {
    switch (f.periode) {
      case 'bulan_lalu': { const b = kurangiBulan(hariIni, 1); return [awalBulan(b), akhirBulan(b)]; }
      case 'minggu_ini': return [awalMinggu(hariIni), hariIni];
      case 'kustom': return [validTgl(f.mulai) ? f.mulai : awalBulan(hariIni), validTgl(f.selesai) ? f.selesai : hariIni];
      default: return [awalBulan(hariIni), akhirBulan(hariIni)];
    }
  })();
  if (s < m) [m, s] = [s, m];
  if (selisihHari(m, s) > 370) m = tambahHari(s, -370);
  return [m, s];
}
