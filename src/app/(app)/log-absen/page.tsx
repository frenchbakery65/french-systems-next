import { and, desc, eq, gte, ilike, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Halaman, nomorHalaman } from '@/components/halaman';
import { Badge, Judul } from '@/components/ui';
import { wajibLogin } from '@/lib/auth/sesi';
import { STATUS_SCAN, SUMBER_LOG } from '@/lib/log';
import { formatTglBulanTahun, tambahHari, validTgl } from '@/lib/tanggal';

export const metadata = { title: 'Log absen (mentah)' };

const PER_HAL = 50;

export default async function HalamanLogAbsen({ searchParams }: { searchParams: Promise<{ dari?: string; sampai?: string; sumber?: string; pin?: string; hal?: string }> }) {
  await wajibLogin();
  const q = await searchParams;
  const hal = nomorHalaman(q.hal);
  const l = schema.logAbsen;
  const baris = await db
    .select({ l, nama: schema.karyawan.nama, mesin: schema.mesin.nama })
    .from(l).leftJoin(schema.karyawan, eq(schema.karyawan.pin, l.pin)).leftJoin(schema.mesin, eq(schema.mesin.id, l.mesinId))
    .where(and(
      validTgl(q.dari) ? gte(l.waktuScan, `${q.dari} 00:00:00`) : undefined,
      validTgl(q.sampai) ? lt(l.waktuScan, `${tambahHari(q.sampai, 1)} 00:00:00`) : undefined,
      q.sumber && q.sumber in SUMBER_LOG ? eq(l.sumber, q.sumber) : undefined,
      q.pin?.trim() ? ilike(l.pin, `${q.pin.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : undefined,
    ))
    .orderBy(desc(l.waktuScan), desc(l.id)).limit(PER_HAL + 1).offset((hal - 1) * PER_HAL);
  const filter = Object.fromEntries(Object.entries({ dari: q.dari, sampai: q.sampai, sumber: q.sumber, pin: q.pin }).filter(([, v]) => v)) as Record<string, string>;
  return (
    <>
      <Judul judul="Log absen (mentah)" sub="Semua scan seperti diterima dari mesin atau file. Tidak pernah diubah atau dihapus oleh aplikasi." />
      <div className="ab">
        <form className="ab-filters">
          <input className="ab-input" type="date" name="dari" defaultValue={q.dari} aria-label="Dari tanggal" />
          <span className="ab-muted">s/d</span>
          <input className="ab-input" type="date" name="sampai" defaultValue={q.sampai} aria-label="Sampai tanggal" />
          <select className="ab-input" name="sumber" defaultValue={q.sumber ?? ''} aria-label="Sumber">
            <option value="">Semua sumber</option>
            {Object.entries(SUMBER_LOG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="ab-input" name="pin" defaultValue={q.pin} placeholder="PIN" aria-label="PIN" style={{ width: 100 }} />
          <button className="ab-btn">Terapkan</button>
        </form>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table ab-table-compact">
              <thead><tr><th>Waktu scan</th><th>PIN</th><th>Nama</th><th>Status scan</th><th>Verifikasi</th><th>Sumber</th><th>Mesin</th></tr></thead>
              <tbody>
                {baris.length === 0 && <tr><td colSpan={7} className="ab-empty">Tidak ada log.</td></tr>}
                {baris.slice(0, PER_HAL).map(({ l: x, nama, mesin }) => (
                  <tr key={x.id}>
                    <td className="ab-mono">{formatTglBulanTahun(x.waktuScan.slice(0, 10))} {x.waktuScan.slice(11, 19)}</td>
                    <td className="ab-mono">{x.pin}</td>
                    <td>{nama ?? <span className="ab-text-warn">— PIN tidak dikenal —</span>}</td>
                    <td>{x.statusScan === null ? '-' : STATUS_SCAN[x.statusScan] ?? `Kode ${x.statusScan}`}</td>
                    <td>{x.verifikasi || '-'}</td>
                    <td><Badge warna="muted">{SUMBER_LOG[x.sumber] ?? x.sumber}</Badge></td>
                    <td>{mesin ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Halaman hal={hal} ada={baris.length > PER_HAL} href={(h) => `/log-absen?${new URLSearchParams({ ...filter, hal: String(h) })}`} />
        </section>
      </div>
    </>
  );
}
