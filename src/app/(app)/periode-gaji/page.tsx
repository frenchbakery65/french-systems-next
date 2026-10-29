import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Badge, Judul } from '@/components/ui';
import { halamanGaji } from '@/lib/auth/sesi';
import { rp } from '@/lib/format';
import { pengaturanGaji } from '@/lib/pengaturan';
import { formatDmy, hariIni } from '@/lib/tanggal';
import { hapusPeriode } from './aksi';
import { FormPeriode } from './form';

export const metadata = { title: 'Periode gaji' };

export default async function HalamanPeriodeGaji() {
  await halamanGaji();
  const p = schema.periodeGaji;
  const [daftar, aturan] = await Promise.all([
    db.select({ p, jumlah: sql<number>`count(${schema.slipGaji.id})::int`, bersih: sql<number>`coalesce(sum(${schema.slipGaji.gajiBersih}), 0)::bigint` })
      .from(p).leftJoin(schema.slipGaji, eq(schema.slipGaji.periodeGajiId, p.id)).groupBy(p.id).orderBy(desc(p.tanggalMulai)),
    pengaturanGaji(),
  ]);
  return (
    <>
      <Judul judul="Periode gaji" />
      <div className="ab">
        <section className="ab-card"><FormPeriode tutupBuku={aturan.tanggalTutupBuku} bulanIni={hariIni()} /></section>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Nama</th><th>Absensi</th><th className="ab-num">Karyawan</th><th className="ab-num">Total gaji bersih</th><th>Status</th><th /></tr></thead>
              <tbody>
                {daftar.length === 0 && <tr><td colSpan={6} className="ab-empty">Belum ada periode gaji.</td></tr>}
                {daftar.map(({ p: x, jumlah, bersih }) => (
                  <tr key={x.id}>
                    <td className="ab-strong"><Link href={`/periode-gaji/${x.id}`}>{x.nama}</Link></td>
                    <td>{formatDmy(x.tanggalMulai)} – {formatDmy(x.tanggalSelesai)}</td>
                    <td className="ab-num">{jumlah}</td>
                    <td className="ab-num">{rp(Number(bersih), true)}</td>
                    <td><Badge warna={x.status === 'final' ? 'ok' : 'warn'}>{x.status === 'final' ? 'Final (dikunci)' : 'Draf'}</Badge></td>
                    <td className="ab-num ab-small">
                      <Link href={`/periode-gaji/${x.id}`}>Buka</Link>
                      {x.status !== 'final' && <>{' · '}<TombolKonfirmasi aksi={hapusPeriode.bind(null, x.id)} kelas="ab-link-btn ab-text-bad" pesan={`Hapus periode ${x.nama} beserta semua slipnya?`} /></>}
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
