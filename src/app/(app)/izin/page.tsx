import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Halaman, nomorHalaman } from '@/components/halaman';
import { Badge, Judul } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { JENIS_IZIN } from '@/lib/absensi/tipe';
import { pilihanKaryawan } from '@/lib/pilihan';
import { formatTglBulanTahun } from '@/lib/tanggal';
import { waktuCatat } from '@/lib/waktu-catat';
import { hapusIzin } from './aksi';

export const metadata = { title: 'Izin / sakit / cuti' };

const PER_HAL = 50;

export default async function HalamanIzin({ searchParams }: { searchParams: Promise<{ jenis?: string; karyawan?: string; hal?: string }> }) {
  const kelola = bisaMengelola(await wajibLogin());
  const q = await searchParams;
  const hal = nomorHalaman(q.hal);
  const iz = schema.izin;
  const [baris, karyawan] = await Promise.all([
    db.select({ iz, nama: schema.karyawan.nama, pencatat: schema.users.name })
      .from(iz).innerJoin(schema.karyawan, eq(schema.karyawan.id, iz.karyawanId)).leftJoin(schema.users, eq(schema.users.id, iz.dibuatOleh))
      .where(and(q.jenis && q.jenis in JENIS_IZIN ? eq(iz.jenis, q.jenis) : undefined, q.karyawan && /^\d+$/.test(q.karyawan) ? eq(iz.karyawanId, Number(q.karyawan)) : undefined))
      .orderBy(desc(iz.tanggalMulai), desc(iz.id)).limit(PER_HAL + 1).offset((hal - 1) * PER_HAL),
    pilihanKaryawan(),
  ]);
  const href = (h: number) => `/izin?${new URLSearchParams({ ...(q.jenis ? { jenis: q.jenis } : {}), ...(q.karyawan ? { karyawan: q.karyawan } : {}), hal: String(h) })}`;
  return (
    <>
      <Judul judul="Izin / sakit / cuti" aksi={kelola && <Link className="ab-btn ab-btn-primary" href="/izin/baru">Catat izin</Link>} />
      <div className="ab">
        <form className="ab-filters">
          <select className="ab-input" name="jenis" defaultValue={q.jenis ?? ''} aria-label="Jenis">
            <option value="">Semua jenis</option>
            {Object.entries(JENIS_IZIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="ab-input" name="karyawan" defaultValue={q.karyawan ?? ''} aria-label="Karyawan">
            <option value="">Semua karyawan</option>
            {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <button className="ab-btn">Terapkan</button>
        </form>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Karyawan</th><th>Jenis</th><th>Mulai</th><th>Selesai</th><th>Kurangi jatah</th><th>Keterangan</th><th>Dicatat oleh</th><th /></tr></thead>
              <tbody>
                {baris.length === 0 && <tr><td colSpan={8} className="ab-empty">Belum ada catatan.</td></tr>}
                {baris.slice(0, PER_HAL).map(({ iz: x, nama, pencatat }) => (
                  <tr key={x.id}>
                    <td className="ab-strong"><Link href={`/karyawan/${x.karyawanId}`} className="ab-person"><span className="ab-person-name">{nama}</span></Link></td>
                    <td><Badge warna="info">{JENIS_IZIN[x.jenis] ?? x.jenis}</Badge></td>
                    <td>{formatTglBulanTahun(x.tanggalMulai)}</td>
                    <td>{formatTglBulanTahun(x.tanggalSelesai)}</td>
                    <td className={x.kurangiJatah ? 'ab-text-warn' : 'ab-muted'}>{x.kurangiJatah ? 'Ya' : 'Tidak'}</td>
                    <td>{x.keterangan ?? <span className="ab-muted">—</span>}</td>
                    <td>{pencatat ?? '—'}<span className="ab-person-sub">{waktuCatat(x.createdAt)}</span></td>
                    <td className="ab-num ab-small">
                      {kelola && <>
                        <Link href={`/izin/${x.id}`}>Ubah</Link>{' · '}
                        <TombolKonfirmasi aksi={hapusIzin.bind(null, x.id)} kelas="ab-link-btn ab-text-bad" pesan={`Hapus catatan ${JENIS_IZIN[x.jenis]?.toLowerCase()} ${nama}?`} />
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Halaman hal={hal} ada={baris.length > PER_HAL} href={href} />
        </section>
      </div>
    </>
  );
}
