import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { FilterPeriode } from '@/components/filter-periode';
import { Badge, Judul, kelasShift } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { rentangFilter } from '@/lib/absensi/filter';
import { daftarTanggalLibur, ringkasJatah } from '@/lib/absensi/jatah-libur';
import { muatPerhitungan } from '@/lib/absensi/muat';
import { formatDurasi, formatMenit, jam } from '@/lib/format';
import { formatTglBulan, hariIni } from '@/lib/tanggal';

const fmtHari = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

export default async function HalamanDetailKaryawan({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ periode?: string; mulai?: string; selesai?: string }>;
}) {
  const u = await wajibLogin();
  const id = Number((await params).id);
  const [k] = Number.isInteger(id)
    ? await db.select({ k: schema.karyawan, departemen: schema.departemen.nama }).from(schema.karyawan)
      .leftJoin(schema.departemen, eq(schema.departemen.id, schema.karyawan.departemenId)).where(eq(schema.karyawan.id, id))
    : [];
  if (!k) notFound();
  const [mulai, selesai] = rentangFilter(await searchParams, hariIni());
  const r = (await muatPerhitungan(mulai, selesai, { karyawanId: id })).rekap()[0];
  const hari = [...r.hari].reverse().filter((h) => h.status !== 'luar_masa_kerja');
  const persen = r.persenHadir();
  const kelola = bisaMengelola(u);

  return (
    <>
      <p className="ab-small"><Link href="/rekap" className="ab-muted">Rekap periode</Link> <span className="ab-muted">›</span> <span className="ab-muted">Detail karyawan</span></p>
      <Judul
        judul={k.k.nama}
        sub={[`PIN ${k.k.pin}`, k.departemen ?? 'Tanpa departemen', k.k.jabatan, k.k.aktif ? null : 'tidak aktif'].filter(Boolean).join(' · ')}
        aksi={kelola && <>
          <Link className="ab-btn" href={`/izin/baru?karyawan=${id}`}><Plus aria-hidden />Izin / sakit / cuti</Link>
          <Link className="ab-btn" href={`/koreksi/baru?karyawan=${id}`}><Plus aria-hidden />Koreksi</Link>
          <Link className="ab-btn" href={`/karyawan/${id}/ubah`}><Pencil aria-hidden />Ubah data</Link>
        </>}
      />
      <div className="ab">
        <FilterPeriode mulai={mulai} selesai={selesai} />
        <section className="ab-stats ab-stats-5">
          <div className="ab-stat"><span className="ab-stat-label">Kehadiran</span><span className="ab-stat-value">{persen !== null ? <>{persen}<small>%</small></> : '—'}</span><span className="ab-stat-note">{r.hadir} dari {r.hariKerja} hari kerja</span></div>
          <div className="ab-stat ab-stat-warn"><span className="ab-stat-label">Telat</span><span className="ab-stat-value">{r.telat}<small>×</small></span><span className="ab-stat-note">total {formatMenit(r.telatMenit) || '0m'}</span></div>
          {r.jatahLibur !== null ? (
            <div className={`ab-stat${r.liburLebih() ? ' ab-stat-bad' : ''}`}>
              <span className="ab-stat-label">Libur</span>
              <span className="ab-stat-value">{r.liburTerpakai}<small>/ {r.jatahLibur}</small></span>
              <span className="ab-stat-note">{ringkasJatah(r)}{r.liburLebih() ? ' (dipotong)' : ''}{r.periodeJatah && ` · periode ${formatTglBulan(r.periodeJatah[0])}–${formatTglBulan(r.periodeJatah[1])}`}</span>
            </div>
          ) : (
            <div className="ab-stat ab-stat-bad"><span className="ab-stat-label">Tidak hadir</span><span className="ab-stat-value">{r.alpa}</span><span className="ab-stat-note">tanpa keterangan</span></div>
          )}
          <div className="ab-stat ab-stat-info"><span className="ab-stat-label">Izin · sakit · cuti</span><span className="ab-stat-value">{r.izin + r.sakit + r.cuti + r.dinas}</span></div>
          <div className="ab-stat"><span className="ab-stat-label">Total jam kerja</span><span className="ab-stat-value ab-stat-value-sm">{formatDurasi(r.durasiMenit)}</span><span className="ab-stat-note">{r.lupaPulang} hari tidak scan pulang</span></div>
        </section>
        {r.jatahLibur !== null && r.tanggalLibur.length > 0 && (
          <p className={`ab-small ${r.liburLebih() ? 'ab-text-bad' : 'ab-muted'}`}>Tanggal libur periode gaji ini: {daftarTanggalLibur(r)}</p>
        )}
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Tanggal</th><th>Shift</th><th className="ab-num">Masuk</th><th className="ab-num">Pulang</th><th className="ab-num">Durasi</th><th>Status</th><th>Keterangan</th></tr></thead>
              <tbody>
                {hari.length === 0 && <tr><td colSpan={7} className="ab-empty">Tidak ada data pada periode ini.</td></tr>}
                {hari.map((h) => (
                  <tr key={h.tanggal} className={!h.hariKerja && !h.hadir() ? 'ab-row-dim' : undefined}>
                    <td><span className="ab-strong">{fmtHari.format(Date.parse(h.tanggal)).replace('.', '')}</span></td>
                    <td>
                      {h.shiftKode ? <span title={h.shiftNama ?? undefined}><Badge warna={kelasShift(h.shiftWarna)}>{h.shiftKode}</Badge></span> : <span className="ab-muted">—</span>}
                      {h.shiftDitebak && <span className="ab-tag" title="Belum punya shift bawaan; ditebak dari scan pertama"> shift ditebak</span>}
                      {h.shiftDitukar && <span className="ab-tag"> ditukar</span>}
                    </td>
                    <td className="ab-num ab-mono">{jam(h.jamMasuk)}</td>
                    <td className="ab-num ab-mono">{h.jamPulang ? jam(h.jamPulang) : h.lupaPulang ? <span className="ab-text-warn">tidak scan</span> : '—'}</td>
                    <td className="ab-num ab-mono ab-muted">{h.durasiMenit ? formatDurasi(h.durasiMenit) : '—'}</td>
                    <td><Badge warna={h.warna()}>{h.label()}{h.telatMenit ? ` ${formatMenit(h.telatMenit)}` : ''}</Badge></td>
                    <td className="ab-small ab-muted">
                      {h.pulangCepatMenit > 0 && `Pulang cepat ${formatMenit(h.pulangCepatMenit)}. `}
                      {h.lemburMenit > 0 && `Lembur ${formatMenit(h.lemburMenit)}. `}
                      {h.tanpaScanMasuk && 'Tidak scan masuk. '}
                      {h.jumlahScan > 2 && `${h.jumlahScan} kali scan. `}
                      {h.dikoreksi && <span className="ab-tag">dikoreksi</span>} {h.catatan}
                      {kelola && h.hariKerja && !h.dikoreksi && (['alpa', 'libur_jatah', 'libur_lebih'].includes(h.status) || h.lupaPulang || h.tanpaScanMasuk || h.scanDiabaikan.length > 0) && (
                        <> <Link href={`/koreksi/baru?karyawan=${id}&tanggal=${h.tanggal}`}>koreksi</Link></>
                      )}
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
