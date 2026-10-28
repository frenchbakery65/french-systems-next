import Link from 'next/link';
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Badge, Judul, kelasShift } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { JadwalHarian } from '@/lib/absensi/jadwal';
import { jadwalUmum } from '@/lib/pengaturan';
import { ringkasShift } from '@/lib/shift';
import { awalMinggu, formatPanjang, formatTglBulan, formatTglBulanTahun, hariIni, tambahHari, validTgl } from '@/lib/tanggal';
import { AksiJadwal, SelJadwal, type Pilihan } from './sel';

export const metadata = { title: 'Jadwal shift' };

const fmtHari = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short' });

export default async function HalamanJadwalShift({ searchParams }: { searchParams: Promise<{ mulai?: string; hari?: string; departemen?: string }> }) {
  const kelola = bisaMengelola(await wajibLogin());
  const q = await searchParams;
  const kini = hariIni();
  const awal = awalMinggu(validTgl(q.mulai) ? q.mulai : kini);
  const jumlahHari = q.hari === '14' ? 14 : 7;
  const akhir = tambahHari(awal, jumlahHari - 1);
  const depId = q.departemen && /^\d+$/.test(q.departemen) ? Number(q.departemen) : null;
  const k = schema.karyawan;

  const [karyawan, shift, umum, libur, departemen, tanpaShift] = await Promise.all([
    db.select({ k, departemen: schema.departemen.nama }).from(k).leftJoin(schema.departemen, eq(schema.departemen.id, k.departemenId))
      .where(and(eq(k.aktif, true), depId ? eq(k.departemenId, depId) : undefined)).orderBy(asc(k.nama)),
    db.select().from(schema.shift).orderBy(asc(schema.shift.jamMasuk)),
    jadwalUmum(),
    db.select().from(schema.hariLibur).where(and(gte(schema.hariLibur.tanggal, awal), lte(schema.hariLibur.tanggal, akhir))),
    db.select({ id: schema.departemen.id, nama: schema.departemen.nama }).from(schema.departemen).orderBy(asc(schema.departemen.nama)),
    db.$count(k, and(eq(k.aktif, true), isNull(k.shiftId))),
  ]);
  const ids = karyawan.map((x) => x.k.id);
  const khusus = ids.length
    ? await db.select().from(schema.jadwalKaryawan).where(and(inArray(schema.jadwalKaryawan.karyawanId, ids), gte(schema.jadwalKaryawan.tanggal, awal), lte(schema.jadwalKaryawan.tanggal, akhir)))
    : [];
  const liburPeta = Object.fromEntries(libur.map((h) => [h.tanggal, h.keterangan]));
  const jadwal = new JadwalHarian(shift, khusus, umum, liburPeta);
  const khususPeta = new Map(khusus.map((j) => [`${j.karyawanId}|${j.tanggal}`, j]));
  const tanggal = Array.from({ length: jumlahHari }, (_, i) => tambahHari(awal, i));
  const pilihan: Pilihan = [
    { nilai: 'bawaan', label: 'Kembali ke shift bawaan' }, { nilai: 'libur', label: 'Libur' },
    ...shift.filter((s) => s.aktif).map((s) => ({ nilai: String(s.id), label: `${s.kode} · ${s.nama} (${ringkasShift(s)})` })),
  ];
  const url = (ubah: Record<string, string | null>) => {
    const p = new URLSearchParams(Object.entries({ mulai: q.mulai ?? null, hari: q.hari ?? null, departemen: q.departemen ?? null, ...ubah }).filter(([, v]) => v) as [string, string][]);
    return `/jadwal-shift${p.size ? `?${p}` : ''}`;
  };
  const judulMinggu = `${formatTglBulan(awal)} – ${formatTglBulanTahun(akhir)}`;

  return (
    <>
      <Judul judul="Jadwal shift" aksi={kelola && <AksiJadwal awal={awal} akhir={akhir} judulMinggu={`${formatTglBulan(awal)} – ${formatTglBulanTahun(tambahHari(awal, 6))}`}
        idKaryawan={ids} karyawan={karyawan.map((x) => ({ id: x.k.id, nama: x.k.nama }))} pilihan={pilihan} />} />
      <div className="ab">
        <div className="ab-toolbar">
          <p className="ab-sub">{judulMinggu}{kelola ? ' · klik sel untuk tukar shift atau libur' : ''}</p>
          <form className="ab-toolbar-right">
            {q.mulai && <input type="hidden" name="mulai" value={q.mulai} />}
            {q.hari && <input type="hidden" name="hari" value={q.hari} />}
            <select className="ab-input" name="departemen" defaultValue={q.departemen ?? ''} aria-label="Departemen">
              <option value="">Semua departemen</option>
              {departemen.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
            <button className="ab-btn">Terapkan</button>
            <div className="ab-seg">
              <Link href={url({ hari: null })} className={jumlahHari === 7 ? 'ab-on' : ''}>1 minggu</Link>
              <Link href={url({ hari: '14' })} className={jumlahHari === 14 ? 'ab-on' : ''}>2 minggu</Link>
            </div>
            <div className="ab-daynav">
              <Link className="ab-btn" href={url({ mulai: tambahHari(awal, -7) })} aria-label="Minggu sebelumnya">‹</Link>
              <Link className="ab-btn" href={url({ mulai: null })}>Minggu ini</Link>
              <Link className="ab-btn" href={url({ mulai: tambahHari(awal, 7) })} aria-label="Minggu berikutnya">›</Link>
            </div>
          </form>
        </div>

        {tanpaShift > 0 && (
          <div className="ab-callout">
            <strong>{tanpaShift} karyawan belum punya shift bawaan.</strong> Jam kerjanya ditebak dari scan pertama (bisa salah).
            Isi shift bawaan di menu <Link href="/karyawan">Karyawan</Link>.
          </div>
        )}

        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table ab-jadwal">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  {tanggal.map((d) => (
                    <th key={d} className={`ab-jadwal-tgl${liburPeta[d] ? ' ab-jadwal-liburnas' : ''}${d === kini ? ' ab-jadwal-hariini' : ''}`} title={liburPeta[d]}>
                      {fmtHari.format(Date.parse(d)).replace('.', '')}<br /><span className="ab-mono">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {karyawan.length === 0 && <tr><td colSpan={tanggal.length + 1} className="ab-empty">Tidak ada karyawan aktif.</td></tr>}
                {karyawan.map(({ k: x, departemen: dep }) => {
                  const ka = { ...x, departemen: dep };
                  return (
                    <tr key={x.id}>
                      <td>
                        <span className="ab-person-name">{x.nama}</span>
                        <span className="ab-person-sub">{dep ?? '—'} · bawaan {shift.find((s) => s.id === x.shiftId)?.kode ?? 'belum ada'}</span>
                      </td>
                      {tanggal.map((d) => {
                        const j = jadwal.untuk(ka, d);
                        const kh = khususPeta.get(`${x.id}|${d}`);
                        const kelas = `ab-jadwal-sel${j.hariKerja ? '' : ' ab-jadwal-libur'}${kh ? ' ab-jadwal-tukar' : ''}`;
                        const judul = kh ? `Ditukar${kh.catatan ? `: ${kh.catatan}` : ''}` : j.shift ? `${j.shift.nama} ${ringkasShift(j.shift)}` : '';
                        const isi = !j.hariKerja ? <span className="ab-jadwal-teks">Libur</span>
                          : j.shift ? <Badge warna={kelasShift(j.shift.warna)}>{j.shift.kode}</Badge>
                          : <span className="ab-jadwal-teks" title="Belum ada shift: ditebak dari scan, cadangan jam jadwal umum">?</span>;
                        return kelola ? (
                          <SelJadwal key={d} karyawanId={x.id} nama={x.nama} tanggal={d} judulTanggal={formatPanjang(d)}
                            awal={kh ? (kh.libur ? 'libur' : String(kh.shiftId)) : 'bawaan'} catatan={kh?.catatan ?? ''} pilihan={pilihan} kelas={kelas} judul={judul}>
                            {isi}
                          </SelJadwal>
                        ) : <td key={d} className={kelas} title={judul}>{isi}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ab-small ab-muted" style={{ marginTop: 10 }}>
            <span className="ab-jadwal-legenda ab-jadwal-tukar" /> ditukar dari shift bawaan · <span className="ab-jadwal-legenda ab-jadwal-libur" /> libur ·{' '}
            <strong>?</strong> belum ada shift bawaan (ditebak dari scan)
          </p>
        </section>
      </div>
    </>
  );
}
