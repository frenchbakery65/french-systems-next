import Link from 'next/link';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Judul } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { hapusDepartemen } from './aksi';
import { FormDepartemen } from './form';

export const metadata = { title: 'Departemen' };

export default async function HalamanDepartemen({ searchParams }: { searchParams: Promise<{ ubah?: string }> }) {
  const kelola = bisaMengelola(await wajibLogin());
  const { ubah } = await searchParams;
  const daftar = await db
    .select({ id: schema.departemen.id, nama: schema.departemen.nama, jumlah: sql<number>`count(${schema.karyawan.id}) filter (where ${schema.karyawan.aktif})::int` })
    .from(schema.departemen).leftJoin(schema.karyawan, eq(schema.karyawan.departemenId, schema.departemen.id))
    .groupBy(schema.departemen.id).orderBy(asc(schema.departemen.nama));
  const diubah = daftar.find((d) => String(d.id) === ubah) ?? null;
  return (
    <>
      <Judul judul="Departemen" />
      <div className="ab">
        {kelola && <section className="ab-card"><FormDepartemen d={diubah} /></section>}
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Nama</th><th className="ab-num">Jumlah karyawan aktif</th><th /></tr></thead>
              <tbody>
                {daftar.length === 0 && <tr><td colSpan={3} className="ab-empty">Belum ada departemen.</td></tr>}
                {daftar.map((d) => (
                  <tr key={d.id}>
                    <td className="ab-strong">{d.nama}</td>
                    <td className="ab-num">{d.jumlah}</td>
                    <td className="ab-num ab-small">
                      {kelola && <>
                        <Link href={`/departemen?ubah=${d.id}`}>Ubah</Link>{' · '}
                        <TombolKonfirmasi aksi={hapusDepartemen.bind(null, d.id)} kelas="ab-link-btn ab-text-bad"
                          pesan={`Hapus departemen ${d.nama}? ${d.jumlah ? `${d.jumlah} karyawan menjadi tanpa departemen.` : ''}`} />
                      </>}
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
