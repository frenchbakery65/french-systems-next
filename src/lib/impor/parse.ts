/**
 * Import log absensi dari file Excel (.xlsx) atau CSV (port dari Impor.php).
 *
 * Kolom dikenali dari nama judul, jadi urutan kolom bebas. Minimal harus ada kolom PIN, Nama, dan waktu scan
 * (satu kolom tanggal+jam, atau kolom tanggal dan kolom jam terpisah). File berisi PIN + Nama saja dibaca
 * sebagai daftar karyawan (mis. ekspor daftar user dari Fingerspot).
 */
import { validTgl } from '../tanggal';

/** Isi sel: teks, angka, tanggal (Date dengan komponen UTC = jam dinding), atau kosong. */
export type Sel = string | number | boolean | Date | null | undefined;

export interface BarisImpor { pin: string; nama: string; waktu: string; verifikasi: string; status: number | null }
export interface HasilImpor { baris: BarisImpor[]; karyawan: Record<string, string>; dilewati: number }

export class GalatImpor extends Error {}

const ALIAS: Record<string, string[]> = {
  pin: ['pin', 'no id', 'no. id', 'id', 'user id', 'userid', 'no', 'nik', 'id karyawan', 'no. akun', 'ac-no', 'ac no', 'enroll id'],
  nama: ['nama', 'name', 'nama karyawan', 'nama pegawai', 'nama lengkap', 'employee name'],
  waktu: ['tanggal waktu', 'tanggal & waktu', 'tgl/waktu', 'tgl waktu', 'waktu scan', 'datetime', 'date time', 'scan', 'tanggal/jam', 'tanggal jam', 'time stamp', 'timestamp'],
  tanggal: ['tanggal', 'tgl', 'date'],
  jam: ['jam', 'waktu', 'time', 'jam scan'],
  status: ['status', 'mode', 'status scan', 'in/out', 'keterangan status', 'state'],
  verifikasi: ['verifikasi', 'verify', 'verified', 'metode'],
};

const STATUS_TEKS: Record<string, number> = {
  masuk: 0, in: 0, 'check in': 0, 'c/in': 0, datang: 0,
  pulang: 1, keluar: 1, out: 1, 'check out': 1, 'c/out': 1,
  istirahat: 2, 'break out': 2, kembali: 3, 'break in': 3,
  'lembur masuk': 4, 'overtime in': 4, 'lembur pulang': 5, 'overtime out': 5,
};

const norm = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const kosong = (r: Sel[]) => !r.some((v) => v !== null && v !== undefined && v !== '');
const dua = (n: number) => String(n).padStart(2, '0');

function cariKolom(header: Sel[]): Record<string, number> {
  const hasil: Record<string, number> = {};
  const n = header.map((h) => (typeof h === 'string' ? norm(h) : ''));
  for (const [kunci, alias] of Object.entries(ALIAS)) {
    const i = n.findIndex((h, idx) => alias.includes(h) && !Object.values(hasil).includes(idx));
    if (i >= 0) hasil[kunci] = i;
  }
  // "Waktu" dengan kolom tanggal terpisah berarti jam saja
  if (hasil.waktu !== undefined && hasil.tanggal !== undefined && hasil.jam === undefined) { hasil.jam = hasil.waktu; delete hasil.waktu; }
  // Kolom "Waktu" tanpa kolom tanggal dianggap berisi tanggal + jam sekaligus
  if (hasil.jam !== undefined && hasil.tanggal === undefined && hasil.waktu === undefined) { hasil.waktu = hasil.jam; delete hasil.jam; }
  return hasil;
}

const tglDate = (d: Date) => `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;
const jamDate = (d: Date) => `${dua(d.getUTCHours())}:${dua(d.getUTCMinutes())}:${dua(d.getUTCSeconds())}`;

/** Teks tanggal dalam beberapa format → "YYYY-MM-DD". */
function keTanggal(v: Sel): string | null {
  if (v instanceof Date) return tglDate(v);
  const t = String(v ?? '').trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (m) return cek(`${m[1]}-${dua(+m[2])}-${dua(+m[3])}`);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) return cek(`${m[3].length === 2 ? `20${m[3]}` : m[3]}-${dua(+m[2])}-${dua(+m[1])}`); // d/m/Y (format Indonesia)
  return null;
}
const cek = (t: string) => (validTgl(t) ? t : null);

/** Jam: teks "07:55[:12]" / "07.55", pecahan hari dari Excel, atau Date → "HH:MM:SS". */
function keJam(v: Sel): string | null {
  if (v instanceof Date) return jamDate(v);
  if (typeof v === 'number') {
    if (v < 0 || v >= 1) return null;
    const d = Math.round(v * 86400);
    return `${dua(Math.floor(d / 3600))}:${dua(Math.floor((d % 3600) / 60))}:${dua(d % 60)}`;
  }
  const m = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/.exec(String(v ?? '').trim());
  if (!m || +m[1] > 23 || +m[2] > 59 || +(m[3] ?? 0) > 59) return null;
  return `${dua(+m[1])}:${m[2]}:${m[3] ?? '00'}`;
}

/** Tanggal + jam dalam satu sel → "YYYY-MM-DD HH:MM:SS". */
function keWaktu(v: Sel): string | null {
  if (v instanceof Date) return `${tglDate(v)} ${jamDate(v)}`;
  const t = String(v ?? '').trim().replace('T', ' ');
  const m = /^(\S+)\s+(\S+)$/.exec(t);
  if (!m) return null;
  const tgl = keTanggal(m[1]);
  const jam = keJam(m[2]);
  return tgl && jam ? `${tgl} ${jam}` : null;
}

function keStatus(v: Sel): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.trunc(v);
  const t = norm(v);
  if (/^-?\d+$/.test(t)) return Number(t);
  return STATUS_TEKS[t] ?? null;
}

const kePin = (v: Sel) => (typeof v === 'number' && Number.isInteger(v) ? String(v) : String(v ?? '').trim());
const keNama = (v: Sel) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function parseBaris(rows: Sel[][]): HasilImpor {
  let header: number | null = null;
  let kolom: Record<string, number> = {};
  let kandidat: [number, Record<string, number>] | null = null; // judul PIN + Nama tanpa kolom waktu → daftar karyawan
  for (const [i, r] of rows.slice(0, 15).entries()) {
    const k = cariKolom(r);
    if (k.pin !== undefined && (k.waktu !== undefined || k.tanggal !== undefined)) { header = i; kolom = k; break; }
    if (k.pin !== undefined && k.nama !== undefined && k.jam === undefined && !kandidat) kandidat = [i, k];
  }
  if (header === null && kandidat) return daftarKaryawan(rows.slice(kandidat[0] + 1), kandidat[1]);
  if (header === null) throw new GalatImpor('Kolom tidak dikenali. File harus punya judul kolom PIN, Nama, dan Tanggal Waktu (atau Tanggal + Jam terpisah). Unduh template untuk contoh.');
  if (kolom.nama === undefined) throw new GalatImpor("Kolom nama tidak ditemukan. Tambahkan kolom 'Nama' berisi nama karyawan. Unduh template untuk contoh.");
  if (kolom.waktu === undefined && kolom.jam === undefined) throw new GalatImpor("Kolom jam tidak ditemukan. Tambahkan kolom 'Jam' atau gunakan kolom 'Tanggal Waktu'.");

  const hasil: HasilImpor = { baris: [], karyawan: {}, dilewati: 0 };
  for (const r of rows.slice(header + 1)) {
    if (kosong(r)) continue;
    const ambil = (k: string) => (kolom[k] !== undefined ? r[kolom[k]] : null);
    const pin = kePin(ambil('pin'));
    const nama = keNama(ambil('nama'));
    let waktu: string | null;
    if (kolom.waktu !== undefined) waktu = keWaktu(ambil('waktu'));
    else {
      const tgl = keTanggal(ambil('tanggal'));
      const j = keJam(ambil('jam'));
      waktu = tgl && j ? `${tgl} ${j}` : null;
    }
    if (pin && nama) hasil.karyawan[pin] = nama;
    if (!pin || !nama || !waktu) { hasil.dilewati++; continue; }
    hasil.baris.push({ pin, nama, waktu, verifikasi: String(ambil('verifikasi') ?? ''), status: keStatus(ambil('status')) });
  }
  return hasil;
}

function daftarKaryawan(rows: Sel[][], kolom: Record<string, number>): HasilImpor {
  const hasil: HasilImpor = { baris: [], karyawan: {}, dilewati: 0 };
  for (const r of rows) {
    if (kosong(r)) continue;
    const pin = kePin(r[kolom.pin]);
    const nama = keNama(r[kolom.nama]);
    if (!pin || !nama) { hasil.dilewati++; continue; }
    hasil.karyawan[pin] = nama;
  }
  return hasil;
}

/** CSV/TSV: pemisah ditebak dari isi (, ; tab |), mendukung tanda kutip. */
export function bacaCsv(teksMentah: string): Sel[][] {
  const teks = teksMentah.replace(/^﻿/, '');
  const contoh = teks.slice(0, 4096);
  const pemisah = [',', ';', '\t', '|'].reduce((a, p) => (contoh.split(p).length > contoh.split(a).length ? p : a), ',');
  const rows: Sel[][] = [];
  for (const line of teks.split(/\r\n|\n|\r/)) {
    if (!line.trim()) continue;
    const sel: string[] = [];
    let cur = '';
    let kutip = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (kutip) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') kutip = false; else cur += c;
      } else if (c === '"' && cur === '') kutip = true;
      else if (c === pemisah) { sel.push(cur); cur = ''; } else cur += c;
    }
    sel.push(cur);
    rows.push(sel);
  }
  return rows;
}
