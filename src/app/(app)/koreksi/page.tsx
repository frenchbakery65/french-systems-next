import { Plus } from 'lucide-react';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Halaman, nomorHalaman } from '@/components/halaman';
import { Judul } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { jam } from '@/lib/format';
import { pilihanKaryawan } from '@/lib/pilihan';
import { formatTglBulanTahun } from '@/lib/tanggal';
import { waktuCatat } from '@/lib/waktu-catat';
import { hapusKoreksi } from './aksi';

export const metadata = { title: 'Koreksi absen' };

const PER_HAL = 50;

export default async function HalamanKoreksi({ searchParams }: { searchParams: Promise<{ karyawan?: string; hal?: string }> }) {
  const kelola = bisaMengelola(await wajibLogin());
  const q = await searchParams;
  const hal = nomorHalaman(q.hal);
  const k = schema.koreksiAbsen;
  const [baris, karyawan] = await Promise.all([
    db.select({ k, nama: schema.karyawan.nama, pencatat: schema.users.name })
      .from(k).innerJoin(schema.karyawan, eq(schema.karyawan.id, k.karyawanId)).leftJoin(schema.users, eq(schema.users.id, k.dibuatOleh))
      .where(q.karyawan && /^\d+$/.test(q.karyawan) ? eq(k.karyawanId, Number(q.karyawan)) : undefined)
      .orderBy(desc(k.tanggal), desc(k.id)).limit(PER_HAL + 1).offset((hal - 1) * PER_HAL),
    pilihanKaryawan(),
  ]);
  return (
    <>
      <Judul judul="Koreksi absen" sub="Menimpa jam masuk/pulang dari mesin (mis. lupa scan). Log asli tetap disimpan."
        aksi={kelola && <Link className="ab-btn ab-btn-primary" href="/koreksi/baru"><Plus aria-hidden />Tambah koreksi</Link>} />
      <div className="ab">
        <form className="ab-filters">
          <select className="ab-input" name="karyawan" defaultValue={q.karyawan ?? ''} aria-label="Karyawan">
            <option value="">Semua karyawan</option>
            {karyawan.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
          </select>
          <button className="ab-btn">Terapkan</button>
        </form>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Karyawan</th><th>Tanggal</th><th className="ab-num">Masuk</th><th className="ab-num">Pulang</th><th>Alasan</th><th>Dicatat oleh</th><th /></tr></thead>
              <tbody>
                {baris.length === 0 && <tr><td colSpan={7} className="ab-empty">Belum ada koreksi.</td></tr>}
                {baris.slice(0, PER_HAL).map(({ k: x, nama, pencatat }) => (
                  <tr key={x.id}>
                    <td className="ab-strong"><Link href={`/karyawan/${x.karyawanId}`} className="ab-person"><span className="ab-person-name">{nama}</span></Link></td>
                    <td>{formatTglBulanTahun(x.tanggal)}</td>
                    <td className="ab-num ab-mono">{jam(x.jamMasuk)}</td>
                    <td className="ab-num ab-mono">{jam(x.jamPulang)}</td>
                    <td>{x.alasan}</td>
                    <td>{pencatat ?? '—'}<span className="ab-person-sub">{waktuCatat(x.createdAt)}</span></td>
                    <td className="ab-num ab-small">
                      {kelola && <>
                        <Link href={`/koreksi/${x.id}`}>Ubah</Link>{' · '}
                        <TombolKonfirmasi aksi={hapusKoreksi.bind(null, x.id)} kelas="ab-link-btn ab-text-bad" pesan={`Hapus koreksi ${nama} tanggal ${formatTglBulanTahun(x.tanggal)}?`} />
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Halaman hal={hal} ada={baris.length > PER_HAL} href={(h) => `/koreksi?${new URLSearchParams({ ...(q.karyawan ? { karyawan: q.karyawan } : {}), hal: String(h) })}`} />
        </section>
      </div>
    </>
  );
}
