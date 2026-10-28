/** Port dari tests/Feature/SinkronDanImporTest.php (bagian parser). */
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { bacaCsv, GalatImpor, parseBaris, type Sel } from '@/lib/impor/parse';

async function bacaXlsx(buf: ArrayBuffer): Promise<Sel[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const rows: Sel[][] = [];
  wb.worksheets[0].eachRow((row) => rows.push(Array.from({ length: row.cellCount }, (_, i) => row.getCell(i + 1).value as Sel)));
  return rows;
}

describe('import file', () => {
  it('template Excel bisa diimpor', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Log');
    ws.addRow(['PIN', 'Nama', 'Tanggal Waktu', 'Status']);
    ws.addRow(['1', 'Budi Santoso', new Date(Date.UTC(2026, 9, 1, 7, 55, 12)), 'Masuk']);
    ws.addRow(['1', 'Budi Santoso', new Date(Date.UTC(2026, 9, 1, 17, 3, 40)), 'Pulang']);
    ws.addRow([2, 'Siti Aminah', new Date(Date.UTC(2026, 9, 1, 8, 12, 5)), '']);
    const h = parseBaris(await bacaXlsx(await wb.xlsx.writeBuffer() as ArrayBuffer));
    expect(h.baris).toHaveLength(3);
    expect(h.baris[0].waktu).toBe('2026-10-01 07:55:12');
    expect(h.baris[1].status).toBe(1);
    expect(h.baris[2]).toMatchObject({ pin: '2', status: null });
  });

  it('CSV tanggal dan jam terpisah', () => {
    const h = parseBaris(bacaCsv('No. ID;Nama;Tanggal;Jam;Status\n5;Eko;12/10/2026;07:45;Masuk\n5;Eko;12/10/2026;17:10;Pulang\nbad;;;;\n'));
    expect(h.baris).toHaveLength(2);
    expect(h.dilewati).toBe(1);
    expect([h.baris[0].pin, h.baris[0].waktu, h.baris[0].status]).toEqual(['5', '2026-10-12 07:45:00', 0]);
  });

  it('daftar karyawan tanpa waktu', () => {
    const h = parseBaris(bacaCsv('PIN,Nama\n5,Eko Saputra\n6,Fajar Nugroho\n7,\n'));
    expect(h.baris).toEqual([]);
    expect(h.karyawan).toEqual({ 5: 'Eko Saputra', 6: 'Fajar Nugroho' });
    expect(h.dilewati).toBe(1);
  });

  it('jam bertitik format Indonesia, kutip CSV, dan kolom tidak dikenal', () => {
    const h = parseBaris(bacaCsv('"PIN","Nama","Waktu Scan"\n"9","Dewi, S.Pd","01/10/2026 08.02.39"\n'));
    expect(h.baris[0]).toMatchObject({ pin: '9', nama: 'Dewi, S.Pd', waktu: '2026-10-01 08:02:39' });
    expect(() => parseBaris(bacaCsv('a,b\n1,2'))).toThrow(GalatImpor);
  });
});
