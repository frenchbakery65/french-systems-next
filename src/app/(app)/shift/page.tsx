import Link from 'next/link';
import { asc, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Badge, Judul, kelasShift } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { ringkasShift } from '@/lib/shift';
import { hapusShift } from './aksi';
import { FormShift } from './form';

export const metadata = { title: 'Shift' };

export default async function HalamanShift({ searchParams }: { searchParams: Promise<{ ubah?: string }> }) {
  await halamanPengelola();
  const { ubah } = await searchParams;
  const s = schema.shift;
  // Ditulis "shift.id": ${s.id} di sini dirender tanpa nama tabel ("id") dan terbaca sebagai k.id di dalam subquery.
  const daftar = await db.select({
    s,
    karyawan: sql<number>`(select count(*) from karyawan k where k.shift_id = shift.id and k.aktif)::int`,
    dipakai: sql<boolean>`exists(select 1 from karyawan k where k.shift_id = shift.id) or exists(select 1 from jadwal_karyawan j where j.shift_id = shift.id)`,
  }).from(s).orderBy(asc(s.jamMasuk));
  const diubah = daftar.find((x) => String(x.s.id) === ubah)?.s ?? null;
  return (
    <>
      <Judul judul="Shift" sub="Jam kerja per shift. Shift bawaan diatur per karyawan; tukar per tanggal di Jadwal shift." />
      <div className="ab">
        <section className="ab-card"><FormShift s={diubah} /></section>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Kode</th><th>Nama</th><th>Jam</th><th className="ab-num">Toleransi</th><th className="ab-num">Karyawan</th><th>Aktif</th><th /></tr></thead>
              <tbody>
                {daftar.map(({ s: x, karyawan, dipakai }) => (
                  <tr key={x.id} className={x.aktif ? undefined : 'ab-row-dim'}>
                    <td><Badge warna={kelasShift(x.warna)}>{x.kode}</Badge></td>
                    <td className="ab-strong">{x.nama}</td>
                    <td className="ab-mono">{ringkasShift(x)}</td>
                    <td className="ab-num">{x.toleransiTelatMenit} mnt</td>
                    <td className="ab-num">{karyawan}</td>
                    <td>{x.aktif ? 'Ya' : 'Tidak'}</td>
                    <td className="ab-num ab-small">
                      <Link href={`/shift?ubah=${x.id}`}>Ubah</Link>
                      {(!dipakai || x.aktif) && <>{' · '}
                        <TombolKonfirmasi aksi={hapusShift.bind(null, x.id)} kelas="ab-link-btn ab-text-bad"
                          label={dipakai ? 'Nonaktifkan' : 'Hapus'}
                          pesan={dipakai
                            ? `Shift ${x.kode} masih dipakai karyawan atau jadwal, jadi tidak bisa dihapus. Nonaktifkan? Shift nonaktif tetap berlaku untuk karyawan yang sudah memakainya.`
                            : `Hapus shift ${x.kode}?`} />
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
