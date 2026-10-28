import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { FilterPeriode } from '@/components/filter-periode';
import { Avatar, Judul } from '@/components/ui';
import { wajibLogin } from '@/lib/auth/sesi';
import { rentangFilter } from '@/lib/absensi/filter';
import { daftarTanggalLibur, ringkasJatah } from '@/lib/absensi/jatah-libur';
import { muatPerhitungan } from '@/lib/absensi/muat';
import { formatDurasi, formatMenit } from '@/lib/format';
import { formatTglBulan, formatTglBulanTahun, hariIni } from '@/lib/tanggal';

export const metadata = { title: 'Rekap periode' };

type Cari = { periode?: string; mulai?: string; selesai?: string; departemen?: string };

const rataRata = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, x) => a + x, 0) / xs.length) : null);

export default async function HalamanRekap({ searchParams }: { searchParams: Promise<Cari> }) {
  await wajibLogin();
  const q = await searchParams;
  const kini = hariIni();
  const [mulai, selesai] = rentangFilter(q, kini);
  const departemenId = q.departemen && /^\d+$/.test(q.departemen) ? Number(q.departemen) : null;
  const [hitung, daftarDepartemen] = await Promise.all([
    muatPerhitungan(mulai, selesai, { departemenId }),
    db.select({ id: schema.departemen.id, nama: schema.departemen.nama }).from(schema.departemen).orderBy(asc(schema.departemen.nama)),
  ]);
  const rekap = hitung.rekap();
  const jumlah = (f: (r: (typeof rekap)[number]) => number) => rekap.reduce((a, r) => a + f(r), 0);
  const total = {
    telat: jumlah((r) => r.telat),
    alpa: jumlah((r) => r.alpa),
    lupaPulang: jumlah((r) => r.lupaPulang),
    // karyawan tanpa hari kerja di rentang ini (persen null) tidak ikut dirata-rata
    persen: rataRata(rekap.map((r) => r.persenHadir()).filter((x): x is number => x !== null)),
  };
  const kueri = new URLSearchParams(Object.entries({ periode: q.periode, mulai: q.mulai, selesai: q.selesai }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <Judul
        aksi={<a className="ab-btn" href={`/api/ekspor/rekap?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`}>Export Excel</a>}
        judul={`${formatTglBulanTahun(mulai)} – ${formatTglBulanTahun(selesai)}`}
        sub={`${selesai > kini ? `Dihitung sampai hari ini (${formatTglBulan(kini)}). ` : ''}Klik nama untuk melihat detail harian.`}
      />
      <div className="ab">
        <FilterPeriode mulai={mulai} selesai={selesai} departemen={daftarDepartemen} />
        <section className="ab-stats">
          <div className="ab-stat"><span className="ab-stat-label">Rata-rata kehadiran</span><span className="ab-stat-value">{total.persen !== null ? <>{total.persen}<small>%</small></> : '—'}</span></div>
          <div className="ab-stat ab-stat-warn"><span className="ab-stat-label">Total kejadian telat</span><span className="ab-stat-value">{total.telat}</span></div>
          <div className="ab-stat ab-stat-bad"><span className="ab-stat-label">Total tidak hadir</span><span className="ab-stat-value">{total.alpa}</span><span className="ab-stat-note">hari tanpa keterangan</span></div>
          <div className="ab-stat"><span className="ab-stat-label">Tidak scan pulang</span><span className="ab-stat-value">{total.lupaPulang}</span><span className="ab-stat-note">perlu dicek / dikoreksi</span></div>
        </section>
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table ab-table-rekap">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th className="ab-num" title="Hari kerja dalam periode (tidak termasuk libur)">Hari kerja</th>
                  <th className="ab-num">Hadir</th>
                  <th className="ab-num">Telat</th>
                  <th className="ab-num" title="Akumulasi waktu telat">Total telat</th>
                  <th className="ab-num">Pulang cepat</th>
                  <th className="ab-num" title="Ada scan masuk tapi tidak ada scan pulang">Tdk scan pulang</th>
                  <th className="ab-num">Sakit</th>
                  <th className="ab-num">Izin</th>
                  <th className="ab-num">Tidak hadir</th>
                  <th className="ab-num" title="Karyawan bulanan: libur terpakai / jatah periode gaji berjalan">Libur</th>
                  <th className="ab-num">Jam kerja</th>
                  <th className="ab-num" title="Kerja setelah jam pulang / di hari libur">Lembur</th>
                  <th>Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {rekap.length === 0 && <tr><td colSpan={14} className="ab-empty">Tidak ada karyawan pada filter ini.</td></tr>}
                {rekap.map((r) => {
                  const persen = r.persenHadir();
                  const k = r.karyawan;
                  const shift = hitung.data.shift.find((s) => s.id === k.shiftId)?.kode;
                  return (
                    <tr key={k.id}>
                      <td>
                        <Link className="ab-person" href={`/karyawan/${k.id}${kueri ? `?${kueri}` : ''}`}>
                          <Avatar nama={k.nama} />
                          <span>
                            <span className="ab-person-name">{k.nama}</span>
                            <span className="ab-person-sub">PIN {k.pin} · {k.departemen ?? '—'} · shift {shift ?? 'belum ada'}{r.hari.some((h) => h.shiftDitebak) ? ' (ada hari ditebak)' : ''}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="ab-num">{r.hariKerja}</td>
                      <td className="ab-num ab-strong">{r.hadir}{r.masukLibur > 0 && <span className="ab-muted ab-small" title="Termasuk masuk di hari libur"> (+{r.masukLibur} libur)</span>}</td>
                      <td className={`ab-num${r.telat ? ' ab-text-warn ab-strong' : ''}`}>{r.telat || '–'}</td>
                      <td className="ab-num ab-muted">{formatMenit(r.telatMenit) || '–'}</td>
                      <td className="ab-num">{r.pulangCepat || '–'}</td>
                      <td className={`ab-num${r.lupaPulang ? ' ab-text-warn' : ''}`}>{r.lupaPulang || '–'}</td>
                      <td className="ab-num">{r.sakit || '–'}</td>
                      <td className="ab-num">{r.izin || '–'}</td>
                      <td className={`ab-num${r.alpa ? ' ab-text-bad ab-strong' : ''}`}>{r.alpa || '–'}</td>
                      <td className={`ab-num${r.liburLebih() ? ' ab-text-bad ab-strong' : ''}`}
                        title={r.jatahLibur !== null ? `${ringkasJatah(r)}${r.tanggalLibur.length ? `: ${daftarTanggalLibur(r)}` : ''}` : undefined}>
                        {r.jatahLibur !== null ? (
                          <>
                            {r.liburTerpakai}<span className="ab-muted">/{r.jatahLibur}</span>
                            <span className="ab-person-sub">{r.liburLebih() ? `lebih ${r.liburLebih()}` : `sisa ${r.sisaJatah()}`}</span>
                          </>
                        ) : '–'}
                      </td>
                      <td className="ab-num ab-mono">{formatDurasi(r.durasiMenit)}</td>
                      <td className={`ab-num ab-mono${r.lemburMenit ? '' : ' ab-muted'}`}>{r.lemburMenit ? formatDurasi(r.lemburMenit) : '–'}</td>
                      <td>
                        {persen !== null ? (
                          <span className="ab-bar-cell">
                            <span className="ab-meter ab-meter-sm"><span style={{ width: `${persen}%` }} className={persen < 80 ? 'ab-m-bad' : persen < 95 ? 'ab-m-warn' : ''} /></span>
                            <span className="ab-mono">{persen}%</span>
                          </span>
                        ) : <span className="ab-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <p className="ab-footnote">
          Kehadiran = hari hadir dibagi hari kerja (izin yang tidak dihitung tidak hadir dan libur dalam jatah tidak mengurangi persentase).
          Libur = libur karyawan bulanan yang sudah dipakai / jatah di periode gaji berjalan (termasuk izin/sakit yang ditandai mengurangi jatah); kelebihannya dipotong gaji.
          Jam kerja = total selisih jam masuk dan jam pulang.
        </p>
      </div>
    </>
  );
}
