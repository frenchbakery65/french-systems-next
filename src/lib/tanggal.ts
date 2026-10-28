/**
 * Utilitas tanggal & jam. Semua tanggal adalah teks "YYYY-MM-DD" dan jam "HH:MM:SS" (jam dinding Asia/Jakarta),
 * sehingga hasilnya sama di laptop maupun di server Vercel (yang berzona UTC).
 */
export const ZONA = 'Asia/Jakarta';

export type Tgl = string; // "YYYY-MM-DD"

const keUtc = (t: Tgl) => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
const dariUtc = (ms: number): Tgl => new Date(ms).toISOString().slice(0, 10);

export function tambahHari(t: Tgl, n: number): Tgl {
  return dariUtc(keUtc(t) + n * 86_400_000);
}

/** Selisih hari b − a. */
export function selisihHari(a: Tgl, b: Tgl): number {
  return Math.round((keUtc(b) - keUtc(a)) / 86_400_000);
}

/** 0 = Minggu … 6 = Sabtu (sama dengan Carbon dayOfWeek). */
export function hariDalamMinggu(t: Tgl): number {
  return new Date(keUtc(t)).getUTCDay();
}

export function jumlahHariBulan(tahun: number, bulan: number): number {
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate(); // bulan 1–12
}

export function buatTgl(tahun: number, bulan: number, hari: number): Tgl {
  // normalisasi bulan di luar 1–12
  const d = new Date(Date.UTC(tahun, bulan - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(hari).padStart(2, '0')}`;
}

export const minTgl = (a: Tgl, b: Tgl) => (a < b ? a : b);
export const maxTgl = (a: Tgl, b: Tgl) => (a > b ? a : b);

export function awalBulan(t: Tgl): Tgl {
  return t.slice(0, 8) + '01';
}

export function akhirBulan(t: Tgl): Tgl {
  return t.slice(0, 8) + String(jumlahHariBulan(+t.slice(0, 4), +t.slice(5, 7))).padStart(2, '0');
}

/** Bulan sebelumnya tanpa melimpah (31 Mar → 28/29 Feb). */
export function kurangiBulan(t: Tgl, n = 1): Tgl {
  let tahun = +t.slice(0, 4);
  let bulan = +t.slice(5, 7) - n;
  while (bulan < 1) { bulan += 12; tahun--; }
  while (bulan > 12) { bulan -= 12; tahun++; }
  const hari = Math.min(+t.slice(8, 10), jumlahHariBulan(tahun, bulan));
  return buatTgl(tahun, bulan, hari);
}

/** Senin minggu ini. */
export function awalMinggu(t: Tgl): Tgl {
  const h = hariDalamMinggu(t);
  return tambahHari(t, h === 0 ? -6 : 1 - h);
}

export function validTgl(t: unknown): t is Tgl {
  return typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && dariUtc(keUtc(t)) === t;
}

/** Jam "HH:MM[:SS]" → menit sejak tengah malam. */
export function keMenit(jam: string | null | undefined): number {
  if (!jam) return 0;
  const [h = '0', m = '0'] = jam.split(':');
  return (+h || 0) * 60 + (+m || 0);
}

/** Waktu sekarang di Asia/Jakarta: { tanggal, jam } (bisa ditimpa untuk tes). */
export function sekarang(acuan: Date = new Date()): { tanggal: Tgl; jam: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(acuan).map((x) => [x.type, x.value]),
  );
  return { tanggal: `${p.year}-${p.month}-${p.day}`, jam: `${p.hour}:${p.minute}:${p.second}` };
}

export const hariIni = () => sekarang().tanggal;

const fmt = (opsi: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...opsi });
const fmtPanjang = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTglBulan = fmt({ day: 'numeric', month: 'short' });
const fmtTglBulanTahun = fmt({ day: 'numeric', month: 'short', year: 'numeric' });

/** "Rabu, 28 Oktober 2026" */
export const formatPanjang = (t: Tgl) => fmtPanjang.format(keUtc(t));
/** "28 Okt" */
export const formatTglBulan = (t: Tgl) => fmtTglBulan.format(keUtc(t)).replace('.', '');
/** "28 Okt 2026" */
export const formatTglBulanTahun = (t: Tgl) => fmtTglBulanTahun.format(keUtc(t)).replace('.', '');
/** "28/10/2026" */
export const formatDmy = (t: Tgl) => `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}`;

/** "3 menit lalu" dsb., untuk status sinkron. */
export function sejak(waktu: Date | null, acuan = new Date()): string {
  if (!waktu) return 'belum pernah';
  const detik = Math.max(0, Math.round((acuan.getTime() - waktu.getTime()) / 1000));
  if (detik < 60) return `${detik} detik lalu`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}
