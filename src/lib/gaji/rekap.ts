/**
 * Susunan rekap gaji satu periode seperti rekapan kertas toko (14 kolom, 2 baris per karyawan).
 * Dipakai bersama oleh halaman Detail periode gaji, halaman cetak rekap, dan Export Excel.
 *
 * TOTAL PENERIMAAN = G.Pokok + T.Profesi + T.Loyalitas + Uang_makan + Lembur + Bonus
 * TOTAL POTONGAN   = Pot.KasBon + Pot.Telat + Pot.Libur + Pot.Lain
 * PENERIMAAN BERSIH = TOTAL PENERIMAAN − TOTAL POTONGAN (sama dengan gaji_bersih)
 */
import { minTgl, selisihHari, type Tgl } from '../tanggal';
import { slipPakaiJatah, type Slip } from './hitung';

export const KOLOM = [
  'NIP', 'Nama Karyawan', 'Hdr', 'Abs', 'G.Pokok', 'T.Profesi', 'T.Loyalitas', 'Uang_makan', 'Lembur', 'Bonus',
  'Pot.KasBon', 'Pot.Telat', 'Pot.Libur', 'Pot.Lain',
] as const;

/** Indeks kolom (0-based) yang berisi uang: G.Pokok s/d Pot.Lain. */
export const KOLOM_UANG = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const KOLOM_PENERIMAAN = [4, 5, 6, 7, 8, 9];
export const KOLOM_POTONGAN = [10, 11, 12, 13];

/** Judul kolom di layar (bahasa biasa). Cetak rekap & Excel tetap memakai KOLOM seperti kertas. */
export const JUDUL_LAYAR: Record<number, string> = {
  2: 'Hadir', 3: 'Abs', 4: 'Gaji pokok', 5: 'Tunj. profesi', 6: 'Tunj. loyalitas', 7: 'Uang makan', 8: 'Lembur', 9: 'Bonus',
  10: 'Kasbon', 11: 'Pot. telat', 12: 'Pot. tidak masuk', 13: 'Pot. lain',
};

export const KETERANGAN_LAYAR: Record<number, string> = {
  2: 'Hdr — hari hadir', 3: 'Abs — libur terpakai (karyawan dengan jatah libur) atau hari tidak hadir',
  12: 'Pot.Libur — libur melebihi jatah (karyawan bulanan) atau tidak hadir tanpa keterangan',
};

/** Letak label & nilai baris total (indeks kolom 0-based): [label dari, label sampai, kolom nilai]. */
const LETAK_TOTAL = { penerimaan: [2, 3, 4], potongan: [6, 7, 8], bersih: [10, 12, 13] } as const;

export const LABEL_TOTAL = { penerimaan: 'TOTAL PENERIMAAN', potongan: 'TOTAL POTONGAN', bersih: 'PENERIMAAN BERSIH' };
export const LABEL_GRAND = { penerimaan: 'Grand Total Penerimaan', potongan: 'Grand Total Potongan', bersih: 'Grand Total Gaji' };

export type Total = { penerimaan: number; potongan: number; bersih: number };
export type SlipRekap = Slip & { id: number; karyawanId: number };
export type Baris = [string, string, number, number, ...number[]];

/** Slip diurutkan berdasarkan NIP (numerik bila semua NIP angka), lalu nama. */
export function urutSlip<T extends Pick<Slip, 'pin' | 'nama'>>(slip: T[]): T[] {
  const angka = slip.every((s) => /^\d+$/.test(s.pin));
  return [...slip].sort((a, b) =>
    (angka ? Number(a.pin) - Number(b.pin) : a.pin.localeCompare(b.pin, 'id', { numeric: true, sensitivity: 'base' })) || a.nama.localeCompare(b.nama));
}

/** Hari tidak masuk: libur terpakai untuk karyawan dengan jatah libur, selain itu tidak hadir (alpa). */
export const abs = (s: Slip) => (slipPakaiJatah(s) ? s.liburTerpakai : s.alpa);

/** Baris 1: 14 nilai sesuai KOLOM. */
export function baris(s: Slip): Baris {
  return [
    s.pin, s.nama.toUpperCase(), s.hadir, abs(s),
    s.gajiPokok, s.tunjanganProfesi, s.tunjanganLoyalitas, s.uangMakan, s.upahLembur, s.bonus,
    s.potKasbon, s.potTelat, s.potAlpa, s.potLain,
  ];
}

/** Baris 2: TOTAL PENERIMAAN, TOTAL POTONGAN, PENERIMAAN BERSIH dari angka baris 1. */
export function total(b: Baris): Total {
  const jumlah = (dari: number, n: number) => (b.slice(dari, dari + n) as number[]).reduce((a, x) => a + x, 0);
  const penerimaan = jumlah(KOLOM_PENERIMAAN[0], KOLOM_PENERIMAAN.length);
  const potongan = jumlah(KOLOM_POTONGAN[0], KOLOM_POTONGAN.length);
  return { penerimaan, potongan, bersih: penerimaan - potongan };
}

export interface Rekap<T extends Slip = SlipRekap> {
  karyawan: { slip: T; baris: Baris; total: Total }[];
  gran: Record<number, number>;
  grand: Total;
}

/** Data lengkap rekap: setiap karyawan (slip, baris, total), Gran Total per kolom, dan Grand Total. */
export function susun<T extends Slip>(slip: T[]): Rekap<T> {
  const gran: Record<number, number> = Object.fromEntries(KOLOM_UANG.map((i) => [i, 0]));
  const grand: Total = { penerimaan: 0, potongan: 0, bersih: 0 };
  const karyawan = urutSlip(slip).map((s) => {
    const b = baris(s);
    const t = total(b);
    for (const i of KOLOM_UANG) gran[i] += b[i] as number;
    grand.penerimaan += t.penerimaan;
    grand.potongan += t.potongan;
    grand.bersih += t.bersih;
    return { slip: s, baris: b, total: t };
  });
  return { karyawan, gran, grand };
}

/** Sel baris total untuk kolom Hdr s/d Pot.Lain: daftar [colspan, 'label'|'nilai'|null, isi]. */
export function selTotal(nilai: Total, label: Record<keyof Total, string>): [number, 'label' | 'nilai' | null, string | number][] {
  const sel: [number, 'label' | 'nilai' | null, string | number][] = [];
  for (let i = 2; i < KOLOM.length; i++) {
    const cocok = (Object.entries(LETAK_TOTAL) as [keyof Total, readonly [number, number, number]][]).find(([, [dari, , kolom]]) => i === dari || i === kolom);
    if (!cocok) { sel.push([1, null, '']); continue; }
    const [k, [dari, sampai, kolom]] = cocok;
    if (i === dari) { sel.push([sampai - dari + 1, 'label', label[k]]); i = sampai; } else if (i === kolom) sel.push([1, 'nilai', nilai[k]]);
  }
  return sel;
}

/** 2300000 → "2.300.000,00" (format total di kertas). */
export const desimal = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Periode 30/08/2026 – 29/09/2026". */
export const judulPeriode = (mulai: Tgl, selesai: Tgl) => {
  const f = (t: Tgl) => `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}`;
  return `Periode ${f(mulai)} – ${f(selesai)}`;
};

export const JUDUL_PERIKSA = {
  gaji0: 'Gaji pokok masih 0',
  tidakBulat: 'Gaji pokok tidak bulat (salah ketik?)',
  jarang: 'Hadir kurang dari separuh hari (scan belum masuk?)',
} as const;

/**
 * Data yang janggal dan perlu dicek sebelum periode dikunci.
 * Gaji pokok 0, gaji pokok di data karyawan tidak bulat ribuan (salah ketik?), dan hadir kurang dari separuh hari yang sudah lewat.
 */
export function periksa<T extends Slip>(slip: (T & { gajiPokokKaryawan: number | null })[], mulai: Tgl, selesai: Tgl, hariIni: Tgl) {
  const sampai = minTgl(selesai, hariIni);
  const hari = sampai < mulai ? 0 : selisihHari(mulai, sampai) + 1;
  const cek: Record<keyof typeof JUDUL_PERIKSA, typeof slip> = { gaji0: [], tidakBulat: [], jarang: [] };
  for (const s of slip) {
    const pokok = s.gajiPokokKaryawan ?? s.gajiPokok;
    if (!s.gajiPokok && (s.jenisPekerja === 'Bulanan' || s.hadir)) cek.gaji0.push(s);
    else if (s.jenisPekerja === 'Bulanan' && pokok % 1000) cek.tidakBulat.push(s);
    if (hari >= 7 && s.hadir * 2 < hari) cek.jarang.push(s);
  }
  return cek;
}
