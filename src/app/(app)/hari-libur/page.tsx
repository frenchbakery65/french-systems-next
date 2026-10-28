import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Judul } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { formatPanjang } from '@/lib/tanggal';
import { hapusHariLibur } from './aksi';
import { FormHariLibur } from './form';

export const metadata = { title: 'Hari libur' };

export default async function HalamanHariLibur({ searchParams }: { searchParams: Promise<{ ubah?: string }> }) {
  const kelola = bisaMengelola(await wajibLogin());
  const { ubah } = await searchParams;
  const daftar = await db.select().from(schema.hariLibur).orderBy(desc(schema.hariLibur.tanggal));
  const diubah = daftar.find((h) => String(h.id) === ubah) ?? null;
  return (
    <>
      <Judul judul="Hari libur" sub="Libur nasional / perusahaan. Tidak dihitung sebagai hari kerja; masuk di hari itu dihitung lembur." />
      <div className="ab">
        {kelola && <section className="ab-card"><FormHariLibur h={diubah} /></section>}
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Tanggal</th><th>Keterangan</th><th /></tr></thead>
              <tbody>
                {daftar.length === 0 && <tr><td colSpan={3} className="ab-empty">Belum ada hari libur.</td></tr>}
                {daftar.map((h) => (
                  <tr key={h.id}>
                    <td className="ab-strong">{formatPanjang(h.tanggal)}</td>
                    <td>{h.keterangan}</td>
                    <td className="ab-num ab-small">
                      {kelola && <>
                        <Link href={`/hari-libur?ubah=${h.id}`}>Ubah</Link>{' · '}
                        <TombolKonfirmasi aksi={hapusHariLibur.bind(null, h.id)} kelas="ab-link-btn ab-text-bad" pesan={`Hapus hari libur ${h.keterangan}?`} />
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
