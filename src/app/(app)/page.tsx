import Link from 'next/link';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Penyegar } from '@/components/penyegar';
import { PilihTanggal } from '@/components/pilih-tanggal';
import { Avatar, Badge, Judul, kelasShift } from '@/components/ui';
import { bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { muatPerhitungan, periodeUntuk, pinTidakDikenal } from '@/lib/absensi/muat';
import type { HariAbsen } from '@/lib/absensi/perhitungan';
import { durasi, formatMenit, jam, rp } from '@/lib/format';
import { mesinBermasalah } from '@/lib/fingerspot/sinkron';
import { perkiraanPotonganTelat } from '@/lib/gaji/upah';
import { formatPanjang, formatTglBulan, hariIni, sejak, tambahHari, validTgl } from '@/lib/tanggal';

export const metadata = { title: 'Hari ini' };

const URUTAN: Record<string, number> = {
  telat: 0, alpa: 1, libur_lebih: 1, belum_hadir: 2, sakit: 3, izin: 4, cuti: 5, dinas: 6, hadir: 7, masuk_libur: 8,
  libur_jatah: 9, belum_mulai: 9, libur: 10, luar_masa_kerja: 11,
};

const grupLibur = (h: HariAbsen) => !h.hariKerja && !h.hadir();
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Judul kelompok baris di tabel Hari ini. */
function grup(h: HariAbsen) {
  if (grupLibur(h)) return 'Libur';
  const j = `${hhmm(h.menitMasukJadwal)}–${hhmm(h.menitPulangJadwal)}`;
  return h.shiftKode ? `${h.shiftKode} · ${h.shiftNama} (${j})` : `Tanpa shift (jadwal umum ${j})`;
}

export default async function HalamanHariIni({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const u = await wajibLogin();
  const kelola = bisaMengelola(u);
  const { tanggal } = await searchParams;
  const kini = hariIni();
  const tgl = validTgl(tanggal) && tanggal <= kini ? tanggal : kini;
  const adalahHariIni = tgl === kini;

  // Dihitung sejak awal periode gaji sampai tanggal ini: akumulasi telat dan urutan libur ke-n (jatah libur bulanan)
  const periode = await periodeUntuk(tgl);
  const hitung = await muatPerhitungan(periode.mulai, tgl, { terhitungSejak: tgl });
  const rekap = hitung.rekap();
  const aturan = hitung.data.aturan;

  const hari = rekap
    .map((r) => r.hari[r.hari.length - 1])
    .filter((h): h is HariAbsen => Boolean(h) && h.tanggal === tgl && h.status !== 'luar_masa_kerja')
    .sort((a, b) => (+grupLibur(a) - +grupLibur(b)) || a.menitMasukJadwal - b.menitMasukJadwal
      || (a.shiftKode ?? '').localeCompare(b.shiftKode ?? '') || (URUTAN[a.status] ?? 99) - (URUTAN[b.status] ?? 99)
      || a.karyawan.nama.localeCompare(b.karyawan.nama));

  const akumulasi = new Map(rekap.map((r) => [r.karyawan.id, {
    kali: r.telat, menit: r.telatMenit, potongan: perkiraanPotonganTelat(r.karyawan, r.telat, r.telatMenit, aturan),
  }]));

  const peran = new Map<string, string>();
  for (const h of hari) {
    if (h.jamMasuk) peran.set(`${h.karyawan.pin}|${h.jamMasuk}`, 'Masuk');
    if (h.jamPulang) peran.set(`${h.karyawan.pin}|${h.jamPulang}`, 'Pulang');
    for (const j of h.scanDiabaikan) peran.set(`${h.karyawan.pin}|${j}`, 'Di luar jam shift');
  }
  const [scanTerbaru, namaPin, pinAsing, mesin] = await Promise.all([
    db.select().from(schema.logAbsen)
      .where(and(gte(schema.logAbsen.waktuScan, `${tgl} 00:00:00`), lt(schema.logAbsen.waktuScan, `${tambahHari(tgl, 1)} 00:00:00`)))
      .orderBy(desc(schema.logAbsen.waktuScan)).limit(12),
    db.select({ pin: schema.karyawan.pin, nama: schema.karyawan.nama }).from(schema.karyawan),
    pinTidakDikenal(30),
    db.select().from(schema.mesin).where(eq(schema.mesin.aktif, true)),
  ]);
  const nama = new Map(namaPin.map((x) => [x.pin, x.nama]));

  const ringkas = {
    total: hari.length,
    hadir: hari.filter((h) => h.hadir()).length,
    telat: hari.filter((h) => h.status === 'telat').length,
    belum: hari.filter((h) => h.status === 'belum_hadir' || h.status === 'alpa').length,
    izin: hari.filter((h) => ['sakit', 'izin', 'cuti', 'dinas'].includes(h.status)).length,
    libur: hari.filter((h) => h.status === 'libur_jatah' || h.status === 'libur_lebih').length,
    lebihJatah: rekap.filter((r) => r.liburLebih() > 0).length,
  };
  const hariKerja = hari.some((h) => h.hariKerja);
  const jumlahShift = new Set(hari.filter((h) => h.hariKerja && h.shiftKode).map((h) => h.shiftKode)).size;
  const tanpaShift = hari.filter((h) => h.hariKerja && !h.karyawan.shiftId).length;
  const liburKet = hitung.data.libur[tgl];
  const { mulaiPakai } = aturan;
  const sebelumMulai = Boolean(mulaiPakai && tgl < mulaiPakai);
  const periodeTelat = `${periode.nama ? `${periode.nama}: ` : ''}${formatTglBulan(periode.mulai)} – ${formatTglBulan(tgl)}`;

  let grupSebelum: string | null = null;
  return (
    <>
      {adalahHariIni && <Penyegar detik={10} />}
      <Judul judul={formatPanjang(tgl)} />
      <div className="ab">
        <div className="ab-toolbar">
          <p className="ab-sub">
            {sebelumMulai
              ? <>Absensi baru dicatat mulai {formatPanjang(mulaiPakai!)} (Pengaturan gaji). Tanggal ini tidak dihitung.</>
              : hariKerja
              ? <>Jam kerja sesuai shift masing-masing{jumlahShift ? ` · ${jumlahShift} shift hari ini` : ''}{tanpaShift ? ` · ${tanpaShift} orang belum punya shift (ditebak)` : ''}</>
              : liburKet ? <>Hari libur: {liburKet}</> : 'Bukan hari kerja'}
          </p>
          <div className="ab-toolbar-right">
            <PilihTanggal tanggal={tgl} hariIni={kini} />
            {mesin.length ? mesin.map((m) => {
              const buruk = mesinBermasalah(m);
              return (
                <Link key={m.id} href="/mesin" className={`ab-pill${buruk ? ' ab-pill-bad' : ''}`}>
                  <span className={`ab-dot ${buruk ? 'ab-dot-bad' : 'ab-dot-ok'}`} />
                  {buruk ? `${m.nama} tidak terhubung · sukses terakhir ${sejak(m.sinkronBerhasilTerakhir)}` : `${m.nama} · sinkron ${sejak(m.sinkronBerhasilTerakhir)}`}
                </Link>
              );
            }) : <Link href="/mesin" className="ab-pill ab-pill-bad"><span className="ab-dot ab-dot-bad" />Belum ada mesin terhubung</Link>}
          </div>
        </div>

        <section className="ab-stats ab-stats-5">
          <div className="ab-stat">
            <span className="ab-stat-label">Hadir</span>
            <span className="ab-stat-value">{ringkas.hadir}<small>/ {ringkas.total}</small></span>
            <span className="ab-meter"><span style={{ width: `${ringkas.total ? Math.round((100 * ringkas.hadir) / ringkas.total) : 0}%` }} /></span>
          </div>
          <div className="ab-stat ab-stat-warn"><span className="ab-stat-label">Telat</span><span className="ab-stat-value">{ringkas.telat}</span><span className="ab-stat-note">orang</span></div>
          <div className="ab-stat ab-stat-bad">
            <span className="ab-stat-label">{adalahHariIni ? 'Belum / tidak hadir' : 'Tidak hadir'}</span>
            <span className="ab-stat-value">{ringkas.belum}</span><span className="ab-stat-note">tanpa keterangan</span>
          </div>
          <div className="ab-stat ab-stat-info"><span className="ab-stat-label">Izin · sakit · cuti</span><span className="ab-stat-value">{ringkas.izin}</span><span className="ab-stat-note">dengan keterangan</span></div>
          <div className={`ab-stat${ringkas.lebihJatah ? ' ab-stat-bad' : ''}`}>
            <span className="ab-stat-label">Melebihi jatah periode ini</span>
            <span className="ab-stat-value">{ringkas.lebihJatah}</span>
            <span className="ab-stat-note">orang · periode ini{ringkas.libur ? ` · ${ringkas.libur} libur hari ini` : ''}</span>
          </div>
        </section>

        {kelola && pinAsing.length > 0 && (
          <div className="ab-callout">
            <strong>Ada scan dari PIN yang belum terdaftar: </strong>
            {pinAsing.map((p) => `PIN ${p.pin} (${p.jumlah}×)`).join(', ')}. Tambahkan sebagai karyawan agar ikut terhitung —{' '}
            <Link href={`/karyawan/baru?pin=${encodeURIComponent(pinAsing[0].pin)}`}>tambah karyawan</Link>.
          </div>
        )}

        <div className="ab-grid-2">
          <section className="ab-card">
            <div className="ab-card-head"><h2>Daftar karyawan</h2><span className="ab-muted ab-small">{ringkas.total} orang</span></div>
            <div className="ab-table-wrap">
              <table className="ab-table">
                <thead>
                  <tr>
                    <th>Nama</th><th>Shift</th><th className="ab-num">Masuk</th><th className="ab-num">Pulang</th><th>Status</th>
                    <th className="ab-num" title={`Akumulasi telat periode gaji ${periodeTelat}`}>Telat periode ini<span className="ab-person-sub">{periodeTelat}</span></th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {hari.length === 0 && (
                    <tr><td colSpan={7} className="ab-empty">{sebelumMulai ? `Absensi baru dicatat mulai ${formatPanjang(mulaiPakai!)}.` : <>Belum ada karyawan.{kelola && <> <Link href="/karyawan/baru">Tambah karyawan</Link> atau tarik dari mesin di menu <Link href="/mesin">Mesin &amp; sinkron</Link>.</>}</>}</td></tr>
                  )}
                  {hari.map((h) => {
                    const g = grup(h);
                    const judulGrup = g !== grupSebelum ? <tr className="ab-shift-grup"><td colSpan={7}>{g}</td></tr> : null;
                    grupSebelum = g;
                    const ak = akumulasi.get(h.karyawan.id);
                    return (
                      <FragmentBaris key={h.karyawan.id} judul={judulGrup}>
                        <tr>
                          <td>
                            <Link className="ab-person" href={`/karyawan/${h.karyawan.id}`}>
                              <Avatar nama={h.karyawan.nama} />
                              <span><span className="ab-person-name">{h.karyawan.nama}</span><span className="ab-person-sub">{h.karyawan.departemen ?? '—'}</span></span>
                            </Link>
                          </td>
                          <td>
                            {h.shiftKode ? <Badge warna={kelasShift(h.shiftWarna)}>{h.shiftKode}</Badge> : <span className="ab-muted">—</span>}
                            {h.shiftDitebak && <span className="ab-tag" title="Belum punya shift bawaan; shift ditebak dari scan pertama"> shift ditebak</span>}
                            {h.shiftDitukar && <span className="ab-tag"> ditukar</span>}
                          </td>
                          <td className="ab-num ab-mono">{jam(h.jamMasuk)}</td>
                          <td className="ab-num ab-mono">
                            {h.jamPulang ? jam(h.jamPulang) : h.lupaPulang ? <span className="ab-text-warn" title="Tidak ada scan pulang">tidak scan</span> : '—'}
                          </td>
                          <td><Badge warna={h.warna()}>{h.label()}{h.telatMenit ? ` ${formatMenit(h.telatMenit)}` : ''}</Badge></td>
                          <td className={`ab-num ${ak?.kali ? 'ab-text-warn' : 'ab-muted'}`}>
                            {ak?.kali ? `${ak.kali}× · ${durasi(ak.menit)}` : '–'}
                            <span className="ab-person-sub">{kelola && ak?.potongan ? `potongan ± Rp${rp(ak.potongan)}` : ''}</span>
                          </td>
                          <td className="ab-small ab-muted">
                            {h.pulangCepatMenit > 0 && `Pulang cepat ${formatMenit(h.pulangCepatMenit)}. `}
                            {h.tanpaScanMasuk && 'Tidak scan masuk. '}
                            {h.dikoreksi && <span className="ab-tag">dikoreksi</span>} {h.catatan}
                            {kelola && h.hariKerja && ['alpa', 'libur_jatah', 'libur_lebih'].includes(h.status) && <>
                              {' '}<Link href={`/izin/baru?karyawan=${h.karyawan.id}&tanggal=${tgl}`}>+ izin</Link> ·{' '}
                              <Link href={`/koreksi/baru?karyawan=${h.karyawan.id}&tanggal=${tgl}`}>+ koreksi</Link>
                            </>}
                            {kelola && (h.lupaPulang || h.scanDiabaikan.length > 0) && !h.dikoreksi && !['alpa', 'libur_jatah', 'libur_lebih'].includes(h.status) && <> <Link href={`/koreksi/baru?karyawan=${h.karyawan.id}&tanggal=${tgl}`}>+ koreksi</Link></>}
                          </td>
                        </tr>
                      </FragmentBaris>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ab-card">
            <div className="ab-card-head">
              <h2>Scan terbaru</h2>
              {adalahHariIni && <span className="ab-live"><span className="ab-dot ab-dot-ok ab-pulse" />diperbarui otomatis</span>}
            </div>
            <ol className="ab-feed">
              {scanTerbaru.length === 0 && <li className="ab-empty">Belum ada scan pada tanggal ini.</li>}
              {scanTerbaru.map((s) => {
                const n = nama.get(s.pin);
                const p = peran.get(`${s.pin}|${s.waktuScan.slice(11, 19)}`) ?? (n ? 'Scan ulang' : '');
                return (
                  <li key={s.id}>
                    <span className="ab-mono ab-feed-time">{s.waktuScan.slice(11, 19)}</span>
                    <span className="ab-feed-who">{n ?? <span className="ab-text-warn">PIN {s.pin} (tidak dikenal)</span>}</span>
                    <span className="ab-feed-what">{p}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

function FragmentBaris({ judul, children }: { judul: React.ReactNode; children: React.ReactNode }) {
  return <>{judul}{children}</>;
}
