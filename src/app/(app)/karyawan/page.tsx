import Link from 'next/link';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Badge, Judul, kelasShift } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { formatTglBulanTahun } from '@/lib/tanggal';
import { TombolAktif } from './tombol-aktif';

export const metadata = { title: 'Karyawan' };

export default async function HalamanKaryawan({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const u = await wajibLogin();
  const kelola = bisaMengelola(u);
  const { q = '', status = 'aktif' } = await searchParams;
  const k = schema.karyawan;
  const cari = q.trim() ? `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const daftar = await db
    .select({ k, departemen: schema.departemen.nama, shiftKode: schema.shift.kode, shiftNama: schema.shift.nama, shiftWarna: schema.shift.warna })
    .from(k)
    .leftJoin(schema.departemen, eq(schema.departemen.id, k.departemenId))
    .leftJoin(schema.shift, eq(schema.shift.id, k.shiftId))
    .where(and(
      status === 'semua' ? undefined : eq(k.aktif, status !== 'nonaktif'),
      cari ? or(ilike(k.nama, cari), ilike(k.pin, cari), ilike(k.jabatan, cari)) : undefined,
    ))
    .orderBy(asc(k.nama));

  return (
    <>
      <Judul judul="Karyawan" aksi={kelola && <Link className="ab-btn ab-btn-primary" href="/karyawan/baru">Tambah karyawan</Link>} />
      <div className="ab">
        <form className="ab-filters">
          <input className="ab-input" name="q" defaultValue={q} placeholder="Cari nama, PIN, jabatan" aria-label="Cari" />
          <select className="ab-input" name="status" defaultValue={status} aria-label="Status">
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Tidak aktif</option>
            <option value="semua">Semua</option>
          </select>
          <button className="ab-btn">Terapkan</button>
        </form>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Nama</th><th>PIN</th><th>Departemen</th><th>Shift</th><th>Jabatan</th><th>Mulai bekerja</th><th>Aktif</th><th></th></tr></thead>
              <tbody>
                {daftar.length === 0 && <tr><td colSpan={8} className="ab-empty">Tidak ada karyawan.</td></tr>}
                {daftar.map((x) => (
                  <tr key={x.k.id}>
                    <td className="ab-strong">{x.k.nama}</td>
                    <td className="ab-mono">{x.k.pin}</td>
                    <td>{x.departemen ?? <span className="ab-muted">—</span>}</td>
                    <td>{x.shiftKode ? <span title={x.shiftNama ?? undefined}><Badge warna={kelasShift(x.shiftWarna)}>{x.shiftKode}</Badge></span> : <span className="ab-muted">belum ada</span>}</td>
                    <td>{x.k.jabatan ?? <span className="ab-muted">—</span>}</td>
                    <td>{x.k.tanggalMasuk ? formatTglBulanTahun(x.k.tanggalMasuk) : <span className="ab-muted">—</span>}</td>
                    <td>{kelola ? <TombolAktif id={x.k.id} aktif={x.k.aktif} /> : x.k.aktif ? 'Ya' : 'Tidak'}</td>
                    <td className="ab-num ab-small">
                      <Link href={`/karyawan/${x.k.id}`}>Lihat absen</Link>
                      {kelola && <> · <Link href={`/karyawan/${x.k.id}/ubah`}>Ubah</Link></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
