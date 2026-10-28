import 'server-only';
import ExcelJS from 'exceljs';
import { bacaCsv, GalatImpor, type Sel } from './parse';

/** Baris dari sheet pertama file .xlsx, atau dari file CSV. */
export async function bacaFile(nama: string, isi: ArrayBuffer): Promise<Sel[][]> {
  const ext = nama.toLowerCase().split('.').pop();
  if (ext === 'xls') throw new GalatImpor("Format .xls (Excel lama) belum didukung. Buka di Excel lalu 'Save As' ke .xlsx atau .csv.");
  if (ext === 'xlsx' || ext === 'xlsm') {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(isi);
    } catch {
      throw new GalatImpor('File Excel tidak bisa dibaca. Pastikan formatnya .xlsx.');
    }
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows: Sel[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const r: Sel[] = [];
      for (let c = 1; c <= row.cellCount; c++) r.push(nilaiSel(row.getCell(c).value));
      rows.push(r);
    });
    return rows;
  }
  let teks = new TextDecoder('utf-8', { fatal: false }).decode(isi);
  if (teks.includes('�')) teks = new TextDecoder('windows-1252').decode(isi);
  return bacaCsv(teks);
}

function nilaiSel(v: ExcelJS.CellValue): Sel {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('result' in v) return nilaiSel(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
  }
  return String(v);
}

/** Template import (sama dengan sistem lama). */
export async function templateImpor(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Log');
  ws.columns = [
    { header: 'PIN', key: 'pin', width: 10 }, { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Tanggal Waktu', key: 'waktu', width: 22, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } }, { header: 'Status', key: 'status', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRows([
    { pin: '1', nama: 'Budi Santoso', waktu: new Date(Date.UTC(2026, 9, 1, 7, 55, 12)), status: 'Masuk' },
    { pin: '1', nama: 'Budi Santoso', waktu: new Date(Date.UTC(2026, 9, 1, 17, 3, 40)), status: 'Pulang' },
    { pin: '2', nama: 'Siti Aminah', waktu: new Date(Date.UTC(2026, 9, 1, 8, 12, 5)), status: '' },
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
