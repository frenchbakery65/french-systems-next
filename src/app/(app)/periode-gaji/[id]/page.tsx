import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/db';
import { Judul } from '@/components/ui';
import { adalahAdmin, halamanPengelola } from '@/lib/auth/sesi';
import { rp } from '@/lib/format';
import { formatJam, slipPakaiJatah } from '@/lib/gaji/hitung';
import { periodeAtau404, slipPeriode } from '@/lib/gaji/muat';
import { segarkan } from '@/lib/gaji/periode-db';
import { JUDUL_LAYAR, JUDUL_PERIKSA, judulPeriode, KETERANGAN_LAYAR, KOLOM_PENERIMAAN, KOLOM_POTONGAN, periksa, susun } from '@/lib/gaji/rekap';
import { formatDmy, hariIni } from '@/lib/tanggal';
import { AksiPeriode, UbahSlip } from './komponen';

export const metadata = { title: 'Detail periode gaji' };

const fmtWaktu = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function HalamanDetailPeriode({ params }: { params: Promise<{ id: string }> }) {
  const u = await halamanPengelola();
  const awal = await periodeAtau404(Number((await params).id));
  if (!awal) notFound();
  await segarkan(awal); // periode draf selalu memakai absensi terbaru
  const p = (await periodeAtau404(awal.id))!;
  const final = p.status === 'final';
  const [slip, pengunci] = await Promise.all([
    slipPeriode(p.id),
    p.dikunciOleh ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.dikunciOleh)) : [],
  ]);
  const rekap = susun(slip);
  const kini = hariIni();
  const cek = final ? null : periksa(slip, p.tanggalMulai, p.tanggalSelesai, kini);
  const lebihJatah = slip.filter((s) => s.liburLebih > 0);
  const jumlah = (f: (s: (typeof slip)[number]) => number) => slip.reduce((a, s) => a + f(s), 0);
  const uang = (n: number) => (n ? rp(n) : null);
  const kosong = <span className="rg-nol" aria-label="nol">–</span>;
  const penting = (s: (typeof slip)[number]) => Boolean(s.catatan || s.liburLebih);
  const catatan = (s: (typeof slip)[number]) => [s.catatanHitung, s.catatan].filter(Boolean).join(' · ');
  const urlDetail = (id: number) => `/karyawan/${id}?periode=kustom&mulai=${p.tanggalMulai}&selesai=${p.tanggalSelesai}`;
  let sub = `Absensi ${formatDmy(p.tanggalMulai)} – ${formatDmy(p.tanggalSelesai)}.`;
  if (final) sub += ` Dikunci ${pengunci[0]?.name ? `oleh ${pengunci[0].name} ` : ''}pada ${p.dikunciPada ? fmtWaktu.format(p.dikunciPada) : '—'}.`;
  else if (p.tanggalSelesai > kini) sub += ' Periode belum selesai — angka absensi masih bisa bertambah. Tekan "Hitung ulang" sebelum dikunci.';

  return (
    <>
      <p className="ab-small"><Link href="/periode-gaji" className="ab-muted">Periode gaji</Link> <span className="ab-muted">›</span> <span className="ab-muted">Detail</span></p>
      <Judul judul={`Gaji ${p.nama}`} sub={sub} aksi={<AksiPeriode id={p.id} final={final} admin={adalahAdmin(u)} />} />
      <div className="ab">
        <section className="ab-stats">
          <div className="ab-stat"><span className="ab-stat-label">Total gaji bersih</span><span className="ab-stat-value ab-stat-value-sm">{rp(jumlah((s) => s.gajiBersih), true)}</span><span className="ab-stat-note">{slip.length} karyawan</span></div>
          <div className="ab-stat ab-stat-info"><span className="ab-stat-label">Total lembur</span><span className="ab-stat-value ab-stat-value-sm">{rp(jumlah((s) => s.upahLembur), true)}</span></div>
          <div className="ab-stat ab-stat-warn"><span className="ab-stat-label">Potongan absen</span><span className="ab-stat-value ab-stat-value-sm">{rp(jumlah((s) => s.potTelat + s.potAlpa), true)}</span><span className="ab-stat-note">telat &amp; tidak hadir</span></div>
          <div className={`ab-stat${final ? '' : ' ab-stat-warn'}`}><span className="ab-stat-label">Status</span>
            <span className="ab-stat-value ab-stat-value-sm">{final ? 'Final' : 'Draf'}</span>
            <span className="ab-stat-note">{final ? 'angka sudah dikunci' : `dihitung ${p.dihitungPada ? fmtWaktu.format(p.dihitungPada) : '—'}`}</span></div>
        </section>

        {!final && lebihJatah.length > 0 && (
          <div className="ab-callout">
            <strong>Cek dulu: lupa scan? Isi <Link href="/koreksi/baru">Koreksi absen</Link> sebelum mengunci.</strong>{' '}
            {lebihJatah.length} karyawan liburnya melebihi jatah dan akan dipotong gaji:{' '}
            {lebihJatah.map((s, i) => <span key={s.id}><Link href={urlDetail(s.karyawanId)}>{s.nama} ({s.liburTerpakai}/{s.jatahLibur})</Link>{i === lebihJatah.length - 1 ? '.' : ', '}</span>)}
          </div>
        )}
        {cek && Object.values(cek).some((x) => x.length) && (
          <div className="ab-callout">
            <strong>Data yang perlu dicek sebelum mengunci:</strong>
            <ul className="rg-cek">
              {(Object.keys(cek) as (keyof typeof cek)[]).filter((k) => cek[k].length).map((k) => (
                <li key={k}>{JUDUL_PERIKSA[k]}:{' '}
                  {cek[k].map((s, i) => (
                    <span key={s.id}>
                      <Link href={k === 'jarang' ? urlDetail(s.karyawanId) : `/karyawan/${s.karyawanId}/ubah`}>{s.nama}</Link>
                      {k === 'jarang' ? ` (${s.hadir} hari)` : k === 'tidakBulat' ? ` (${rp(s.gajiPokokKaryawan)})` : ''}{i === cek[k].length - 1 ? '' : ', '}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className="ab-card">
          <div className="ab-card-head">
            <h2>{judulPeriode(p.tanggalMulai, p.tanggalSelesai)}</h2>
            <span className="ab-muted ab-small">{slip.length} karyawan · urut NIP · cetak &amp; Excel tetap format kertas</span>
          </div>
          {!slip.length ? <p className="ab-empty">Belum ada slip. Tekan &quot;Hitung ulang dari absensi&quot;.</p> : <>
            {/* Layar lebar: satu baris per karyawan, kolom dikelompokkan, Bersih selalu terlihat di kanan */}
            <div className="ab-table-wrap rg-lebar">
              <table className="rg-tabel">
                <thead>
                  <tr className="rg-grup">
                    <th className="rg-nip" rowSpan={2}>NIP</th>
                    <th className="rg-nama" rowSpan={2}>Nama</th>
                    <th colSpan={2} className="rg-awal">Kehadiran</th>
                    <th colSpan={KOLOM_PENERIMAAN.length} className="rg-awal">Penerimaan</th>
                    <th colSpan={KOLOM_POTONGAN.length} className="rg-awal rg-pot">Potongan</th>
                    <th colSpan={2} className="rg-awal">Total</th>
                    <th className="rg-bersih rg-n" rowSpan={2}>Bersih</th>
                    <th className="rg-aksi" rowSpan={2}><span className="ab-sr">Aksi</span></th>
                  </tr>
                  <tr>
                    {Object.entries(JUDUL_LAYAR).map(([i, j]) => (
                      <th key={i} className={`rg-n${['2', '4', '11'].includes(i) ? ' rg-awal' : ''}`} title={KETERANGAN_LAYAR[Number(i)]}>{j}</th>
                    ))}
                    <th className="rg-n rg-awal">Penerimaan</th>
                    <th className="rg-n">Potongan</th>
                  </tr>
                </thead>
                <tbody>
                  {rekap.karyawan.map(({ slip: s, baris: b, total: t }) => (
                    <tr key={s.id}>
                      <td className="rg-nip">{b[0]}</td>
                      <td className="rg-nama" title={catatan(s)}>{b[1]}{penting(s) && <span className="rg-info" aria-label="Ada catatan">i</span>}</td>
                      <td className="rg-n rg-awal">{b[2]}</td>
                      {slipPakaiJatah(s)
                        ? <td className={`rg-n${s.liburLebih ? ' rg-lebih' : ''}`} title={`jatah ${s.jatahLibur}, ${s.liburLebih ? `lebih ${s.liburLebih}` : `sisa ${Math.max(0, s.jatahLibur - s.liburTerpakai)}`}`}>{b[3]}</td>
                        : <td className="rg-n" title="Tidak hadir tanpa keterangan">{b[3] || kosong}</td>}
                      {KOLOM_PENERIMAAN.map((i) => <td key={i} className={`rg-n${i === 4 ? ' rg-awal' : ''}`}>{uang(b[i] as number) ?? kosong}</td>)}
                      {KOLOM_POTONGAN.map((i) => <td key={i} className={`rg-n rg-pot${i === 11 ? ' rg-awal' : ''}`}>{uang(b[i] as number) ?? kosong}</td>)}
                      <td className="rg-n rg-awal">{rp(t.penerimaan)}</td>
                      <td className="rg-n rg-pot">{uang(t.potongan) ?? kosong}</td>
                      <td className={`rg-n rg-bersih${t.bersih < 0 ? ' ab-text-bad' : ''}`}>{rp(t.bersih)}</td>
                      <td className="rg-aksi">
                        {!final && <UbahSlip periodeId={p.id} d={{ ...s, jamOtomatis: formatJam(s.jamLemburOtomatis) }} />}
                        <a href={`/cetak/slip/${p.id}?slip=${s.id}`} target="_blank" rel="noreferrer">Slip</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="rg-nip" colSpan={2}>Total</td>
                    <td className="rg-awal" /><td />
                    {KOLOM_PENERIMAAN.map((i) => <td key={i} className={`rg-n${i === 4 ? ' rg-awal' : ''}`}>{uang(rekap.gran[i]) ?? kosong}</td>)}
                    {KOLOM_POTONGAN.map((i) => <td key={i} className={`rg-n rg-pot${i === 11 ? ' rg-awal' : ''}`}>{uang(rekap.gran[i]) ?? kosong}</td>)}
                    <td className="rg-n rg-awal">{rp(rekap.grand.penerimaan)}</td>
                    <td className="rg-n rg-pot">{uang(rekap.grand.potongan) ?? kosong}</td>
                    <td className="rg-n rg-bersih">{rp(rekap.grand.bersih)}</td>
                    <td className="rg-aksi" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* HP: kartu per karyawan, angka bersih paling besar, rincian bisa dibuka */}
            <div className="rg-kartu-daftar">
              {rekap.karyawan.map(({ slip: s, baris: b, total: t }) => (
                <details key={s.id} className="rg-kartu">
                  <summary>
                    <span className="rg-kartu-nama"><span className="ab-muted">{b[0]}</span> {b[1]}{penting(s) && <span className="rg-info" aria-label="Ada catatan">i</span>}</span>
                    <span className={`rg-kartu-bersih${t.bersih < 0 ? ' ab-text-bad' : ''}`}>{rp(t.bersih, true)}</span>
                    <span className="rg-kartu-sub">Hadir {b[2]} · Abs <span className={s.liburLebih ? 'rg-lebih' : ''}>{b[3]}</span>{slipPakaiJatah(s) && ` (jatah ${s.jatahLibur})`} · Terima {rp(t.penerimaan)} · Potong {rp(t.potongan)}</span>
                  </summary>
                  <dl className="rg-rinci">
                    {KOLOM_PENERIMAAN.filter((i) => b[i]).map((i) => <span key={i} style={{ display: 'contents' }}><dt>{JUDUL_LAYAR[i]}</dt><dd>{rp(b[i] as number)}</dd></span>)}
                    {KOLOM_POTONGAN.filter((i) => b[i]).map((i) => <span key={i} style={{ display: 'contents' }}><dt>{JUDUL_LAYAR[i]}</dt><dd className="rg-pot">−{rp(b[i] as number)}</dd></span>)}
                  </dl>
                  {catatan(s) && <p className="rg-kartu-catatan">{catatan(s)}</p>}
                  <div className="rg-kartu-aksi">
                    {!final && <UbahSlip periodeId={p.id} d={{ ...s, jamOtomatis: formatJam(s.jamLemburOtomatis) }} />}
                    <a href={`/cetak/slip/${p.id}?slip=${s.id}`} target="_blank" rel="noreferrer">Slip</a>
                  </div>
                </details>
              ))}
              <div className="rg-kartu-total"><span>Total {slip.length} karyawan</span><strong>{rp(rekap.grand.bersih, true)}</strong>
                <span className="rg-kartu-sub">Terima {rp(rekap.grand.penerimaan)} · Potong {rp(rekap.grand.potongan)}</span></div>
            </div>
          </>}
        </section>
        <p className="ab-footnote">
          <span className="rg-lebih">Angka merah</span> di kolom Abs = libur melebihi jatah (dipotong gaji). Ikon <span className="rg-info">i</span> = ada catatan atau libur lebih; arahkan kursor ke nama untuk melihat cara hitungnya. – = 0.
          Penerimaan = gaji pokok + lembur + premi hadir + uang makan + tunj. prestasi + bonus + komisi. Potongan = pot. lain + kasbon + pot. absen (telat, tidak hadir/libur lebih) + pinjaman (Pot 4) + Pot 5. Bersih = penerimaan − potongan.
          Upah per jam = upah harian ÷ jam kerja per hari. Lembur = jam lembur × upah per jam (atau upah lembur khusus).
          Karyawan bulanan: libur melebihi jatah × upah harian (gaji pokok ÷ hari per bulan), jatah yang tidak terpakai hangus.
          Potongan telat = total telat sebulan (dibulatkan ke bawah, di bawah batas tidak dipotong) × upah per jam, atau nominal per kali telat sesuai Pengaturan gaji.
          Komponen tetap (gaji pokok, uang makan, tunjangan, premi, upah lembur per jam) diatur di menu Karyawan; aturan potongan di Pengaturan gaji.
        </p>
      </div>
    </>
  );
}
