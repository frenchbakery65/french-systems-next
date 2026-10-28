/** Export Excel (port dari Excel.php & EksporGaji.php) memakai ExcelJS. */
import 'server-only';
import ExcelJS from 'exceljs';
import { and, asc, gte, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Perhitungan, RekapKaryawan } from './absensi/perhitungan';
import { jamLembur, potLibur, slipPakaiJatah } from './gaji/hitung';
import type { slipPeriode } from './gaji/muat';
import { KOLOM, KOLOM_UANG, LABEL_GRAND, LABEL_TOTAL, selTotal, susun, urutSlip, type Total } from './gaji/rekap';
import { STATUS_SCAN, SUMBER_LOG } from './log';
import { hariDalamMinggu, tambahHari } from './tanggal';

type Sel = string | number | Date | null | { nilai: number | string; format?: string; tebal?: boolean };
type Sheet = { nama: string; kolom: string[]; baris: Sel[][]; lebar?: Record<number, number> };

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Tanggal / jam dinding sebagai Date UTC (Excel tidak punya zona waktu). */
const tglExcel = (t: string) => new Date(`${t}T00:00:00Z`);
const waktuExcel = (w: string) => new Date(`${w.replace(' ', 'T')}Z`);
const jamExcel = (j: string | null) => (j ? new Date(`1899-12-30T${j}Z`) : null);

async function tulis(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.nama.replace(/[[\]*?/\\:]/g, '-').slice(0, 31));
    ws.columns = sh.kolom.map((j, i) => ({ header: j, width: sh.lebar?.[i] ?? Math.max(10, Math.min(40, j.length + 4)) }));
    const kepala = ws.getRow(1);
    kepala.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    kepala.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E5F' } }; });
    for (const isi of sh.baris) {
      const row = ws.addRow(isi.map((v) => (v && typeof v === 'object' && !(v instanceof Date) ? v.nilai : v)));
      isi.forEach((v, i) => {
        const c = row.getCell(i + 1);
        if (v instanceof Date) {
          const tgl = v.toISOString();
          c.numFmt = tgl.startsWith('1899-12-30') ? 'hh:mm' : tgl.endsWith('T00:00:00.000Z') ? 'dd/mm/yyyy' : 'dd/mm/yyyy hh:mm:ss';
        } else if (v && typeof v === 'object') {
          if (v.format) c.numFmt = v.format;
          if (v.tebal) c.font = { bold: true };
        }
      });
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- Gaji ---------- */

type SlipEkspor = Awaited<ReturnType<typeof slipPeriode>>[number];

/** Sheet 1 "Rekap gaji" seperti rekapan kertas, sheet 2 "Rincian" berisi semua komponen per karyawan. */
export async function eksporGaji(slip: SlipEkspor[]): Promise<Buffer> {
  const uang = (n: number) => ({ nilai: n, format: '#,##0' });
  const selBaris = (nilai: Total, label: Record<keyof Total, string>): Sel[] => {
    const b: Sel[] = ['', ''];
    for (const [span, jenis, isi] of selTotal(nilai, label)) {
      b.push(jenis === 'label' ? { nilai: isi, tebal: true } : jenis === 'nilai' ? { nilai: isi, format: '#,##0.00', tebal: true } : '');
      for (let i = 1; i < span; i++) b.push('');
    }
    return b;
  };
  const r = susun(slip);
  const rekap: Sel[][] = [];
  for (const { baris: b, total: t } of r.karyawan) {
    rekap.push(b.map((v, i) => (KOLOM_UANG.includes(i) ? uang(v as number) : v)));
    rekap.push(selBaris(t, LABEL_TOTAL));
  }
  rekap.push([{ nilai: 'Gran Total', tebal: true }, '', '', '', ...KOLOM_UANG.map((i) => ({ nilai: r.gran[i], format: '#,##0', tebal: true }))]);
  rekap.push(selBaris(r.grand, LABEL_GRAND));

  const kolom = [
    'No', 'NIP/PIN', 'Nama', 'Departemen', 'Jabatan', 'Hari kerja', 'Hadir', 'Telat', 'Telat (menit)', 'Telat dipotong (menit)',
    'Tidak hadir', 'Izin/sakit/cuti', 'Panjang periode', 'Jatah libur', 'Libur terpakai', 'Libur lebih', 'Upah harian', 'Upah/jam',
    'Gaji pokok', 'Jam lembur', 'Upah lembur/jam', 'Upah lembur', 'Pot. pinjaman', 'Subtotal',
    'Uang makan', 'T. prestasi', 'Premi hadir', 'Komisi', 'Bonus', 'Total penerimaan',
    'Pot. lain', 'Pot. kasbon', 'Pot. telat', 'Pot. tidak hadir', 'Potongan libur', 'Pot 5', 'Total potongan', 'Gaji bersih', 'Catatan',
  ];
  const rincian: Sel[][] = urutSlip(slip).map((s, i) => {
    const j = slipPakaiJatah(s);
    return [
      i + 1, s.pin, s.nama, s.departemen, s.jabatan, s.hariKerja, s.hadir, s.telat, s.menitTelat, s.menitTelatDipotong,
      s.alpa, s.izin, s.panjangPeriode || '', j ? s.jatahLibur : '', j ? s.liburTerpakai : '', j ? s.liburLebih : '',
      s.upahHarian, s.upahPerJam, s.gajiPokok, jamLembur(s), s.tarifLembur, s.upahLembur, s.potPinjaman, s.subtotalGaji,
      s.uangMakan, s.tunjanganPrestasi, s.premiHadir, s.komisi, s.bonus, s.totalPenerimaan,
      s.potLain, s.potKasbon, s.potTelat, s.potAlpa - potLibur(s), potLibur(s), s.pot5, s.totalPotongan, s.gajiBersih,
      [s.catatanHitung, s.catatan].filter(Boolean).join('; '),
    ];
  });
  if (rincian.length) {
    // dijumlah berdasarkan nama kolom supaya tetap benar bila urutan kolom berubah
    const dijumlah = ['Telat (menit)', 'Telat dipotong (menit)', 'Gaji pokok', 'Upah lembur', 'Pot. pinjaman', 'Subtotal', 'Uang makan', 'T. prestasi',
      'Premi hadir', 'Komisi', 'Bonus', 'Total penerimaan', 'Pot. lain', 'Pot. kasbon', 'Pot. telat', 'Pot. tidak hadir', 'Potongan libur', 'Pot 5',
      'Total potongan', 'Gaji bersih'];
    const total: Sel[] = kolom.map(() => '');
    total[2] = 'TOTAL';
    for (const n of dijumlah) { const c = kolom.indexOf(n); total[c] = rincian.reduce((a, b) => a + Number(b[c] || 0), 0); }
    rincian.push(total);
  }
  return tulis([
    { nama: 'Rekap gaji', kolom: [...KOLOM], baris: rekap, lebar: { 0: 8, 1: 26, 2: 6, 3: 6, ...Object.fromEntries(KOLOM_UANG.map((i) => [i, 14])) } },
    { nama: 'Rincian', kolom, baris: rincian, lebar: { 0: 5, 1: 9, 2: 28, 3: 16, 4: 16, [kolom.length - 1]: 40 } },
  ]);
}

/* ---------- Rekap absensi ---------- */

export async function eksporRekapAbsensi(hitung: Perhitungan, rekap: RekapKaryawan[]): Promise<Buffer> {
  const kolomRekap = ['No', 'PIN', 'Nama', 'Departemen', 'Hari kerja', 'Hadir', 'Tepat waktu', 'Telat (kali)', 'Total telat (menit)',
    'Pulang cepat (kali)', 'Total pulang cepat (menit)', 'Tidak scan pulang', 'Sakit', 'Izin', 'Tidak hadir', 'Libur terpakai', 'Jatah libur',
    'Masuk hari libur', 'Total jam kerja', 'Total lembur (jam)', '% Kehadiran'];
  const barisRekap: Sel[][] = rekap.map((r, i) => {
    const k = r.karyawan;
    return [i + 1, k.pin, k.nama, k.departemen ?? '', r.hariKerja, r.hadir, r.tepatWaktu, r.telat, r.telatMenit, r.pulangCepat, r.pulangCepatMenit,
      r.lupaPulang, r.sakit, r.izin, r.alpa, r.jatahLibur === null ? '' : r.liburTerpakai, r.jatahLibur ?? '', r.masukLibur,
      Math.round((r.durasiMenit / 60) * 100) / 100, Math.round((r.lemburMenit / 60) * 100) / 100, r.persenHadir() ?? ''];
  });
  const kolomDetail = ['Tanggal', 'Hari', 'PIN', 'Nama', 'Shift', 'Status', 'Jam masuk', 'Jam pulang', 'Telat (menit)', 'Pulang cepat (menit)',
    'Durasi (jam)', 'Jumlah scan', 'Tidak scan pulang', 'Dikoreksi', 'Catatan'];
  const detail = rekap.flatMap((r) => r.hari.filter((h) => h.status !== 'luar_masa_kerja'))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.karyawan.nama.localeCompare(b.karyawan.nama))
    .map((h): Sel[] => [
      tglExcel(h.tanggal), HARI[hariDalamMinggu(h.tanggal)], h.karyawan.pin, h.karyawan.nama,
      `${h.shiftKode ?? ''}${h.shiftDitebak ? ' (ditebak)' : ''}${h.shiftDitukar ? ' (ditukar)' : ''}`.trim(), h.label(),
      jamExcel(h.jamMasuk), jamExcel(h.jamPulang), h.telatMenit || '', h.pulangCepatMenit || '',
      h.durasiMenit ? Math.round((h.durasiMenit / 60) * 100) / 100 : '', h.jumlahScan, h.lupaPulang ? 'Ya' : '', h.dikoreksi ? 'Ya' : '', h.catatan,
    ]);
  const nama = new Map(hitung.karyawan.map((k) => [k.pin, k.nama]));
  const log = await db.select().from(schema.logAbsen)
    .where(and(gte(schema.logAbsen.waktuScan, `${hitung.mulai} 00:00:00`), lt(schema.logAbsen.waktuScan, `${tambahHari(hitung.selesai, 1)} 00:00:00`)))
    .orderBy(asc(schema.logAbsen.waktuScan));
  const barisLog: Sel[][] = log.map((l) => [waktuExcel(l.waktuScan), l.pin, nama.get(l.pin) ?? '(PIN tidak dikenal)',
    l.statusScan === null ? '-' : STATUS_SCAN[l.statusScan] ?? `Kode ${l.statusScan}`, l.verifikasi ?? '', SUMBER_LOG[l.sumber] ?? l.sumber]);
  return tulis([
    { nama: 'Rekap', kolom: kolomRekap, baris: barisRekap, lebar: { 0: 5, 1: 8, 2: 28, 3: 18 } },
    { nama: 'Detail Harian', kolom: kolomDetail, baris: detail, lebar: { 0: 12, 1: 9, 2: 8, 3: 28, 4: 12, 5: 20, 14: 40 } },
    { nama: 'Log Mentah', kolom: ['Waktu scan', 'PIN', 'Nama', 'Status scan', 'Verifikasi', 'Sumber'], baris: barisLog, lebar: { 0: 20, 1: 8, 2: 28, 3: 18 } },
  ]);
}

export const unduhXlsx = (isi: Buffer, nama: string) => new Response(new Uint8Array(isi), {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nama}"`,
  },
});
