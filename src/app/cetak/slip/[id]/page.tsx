import { notFound } from 'next/navigation';
import { halamanGaji } from '@/lib/auth/sesi';
import { durasi, rp } from '@/lib/format';
import { formatJam, jamLembur, keteranganTelat, keteranganTidakMasuk, slipPakaiJatah } from '@/lib/gaji/hitung';
import { periodeAtau404, slipPeriode } from '@/lib/gaji/muat';
import { segarkan } from '@/lib/gaji/periode-db';
import { namaPerusahaan, pengaturanGaji } from '@/lib/pengaturan';
import { formatDmy, formatTglBulan } from '@/lib/tanggal';
import { TombolCetak } from '../../tombol';


export default async function CetakSlip({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ slip?: string }> }) {
  await halamanGaji();
  const awal = await periodeAtau404(Number((await params).id));
  if (!awal) notFound();
  await segarkan(awal);
  const p = (await periodeAtau404(awal.id))!;
  const { slip: hanya } = await searchParams;
  const [semua, aturan] = await Promise.all([slipPeriode(p.id), pengaturanGaji()]);
  const slip = hanya ? semua.filter((s) => String(s.id) === hanya) : semua;
  if (!slip.length) notFound();
  const final = p.status === 'final';
  const perusahaan = namaPerusahaan();
  const tglSlip = formatDmy(p.tanggalSlip ?? p.tanggalSelesai);
  const periodeLibur = `${formatTglBulan(p.tanggalMulai)}–${formatTglBulan(p.tanggalSelesai)}`;

  return (
    <>
      <title>{`Slip gaji ${p.nama}${slip.length === 1 ? ` — ${slip[0].nama}` : ''}`}</title>
      <style>{'@page { size: A4 portrait; margin: 0; }'}</style>
      <div className="toolbar"><span>{slip.length} slip · {p.nama}</span><TombolCetak /></div>
      <div className="halaman">
        {slip.map((s) => (
          <section key={s.id} className="slip">
            <div className="kop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-french-bakery.png" alt="" className="kop-logo" />
              <div>
                <div className="perusahaan">{perusahaan}</div>
                <div className="judul">Slip gaji{final ? '' : ' — DRAF (belum final)'}</div>
              </div>
            </div>
            <div className="kepala">
              <table><tbody>
                <tr><td>NIP</td><td>{s.pin}</td></tr>
                <tr><td>DEPARTEMEN</td><td>{(s.departemen ?? '-').toUpperCase()}</td></tr>
                <tr><td>JABATAN</td><td>{(s.jabatan ?? '-').toUpperCase()}</td></tr>
              </tbody></table>
              <table><tbody>
                <tr><td>NAMA</td><td>{s.nama.toUpperCase()}</td></tr>
                <tr><td>Jenis Pekerja</td><td>{s.jenisPekerja || '-'}</td></tr>
                <tr><td>Periode</td><td>{formatDmy(p.tanggalMulai)} &rArr; {formatDmy(p.tanggalSelesai)}</td></tr>
              </tbody></table>
            </div>
            <div className="isi">
              <table className="r"><tbody>
                <tr className="h"><td colSpan={3}>PENERIMAAN</td></tr>
                <tr><td className="sub">1. Gaji pokok</td><td className="ket">{s.upahHarian ? `upah harian ${rp(s.upahHarian)} · ${rp(s.upahPerJam)}/jam` : ''}</td><td className="n">{rp(s.gajiPokok)}</td></tr>
                <tr><td className="sub">2. Tunjangan profesi</td><td /><td className="n">{rp(s.tunjanganProfesi)}</td></tr>
                <tr><td className="sub">3. Tunjangan loyalitas</td><td /><td className="n">{rp(s.tunjanganLoyalitas)}</td></tr>
                <tr><td className="sub">4. Uang makan</td><td /><td className="n">{rp(s.uangMakan)}</td></tr>
                <tr><td className="sub">5. Lembur</td><td className="ket">{jamLembur(s) ? `${formatJam(jamLembur(s))} jam × ${rp(s.tarifLembur)}` : ''}</td><td className="n">{rp(s.upahLembur)}</td></tr>
                <tr><td className="sub">6. Bonus</td><td /><td className="n">{rp(s.bonus)}</td></tr>
                <tr className="garis total"><td>TOTAL PENERIMAAN</td><td /><td className="n">{rp(s.totalPenerimaan)}</td></tr>

                <tr className="h"><td colSpan={3}>POTONGAN</td></tr>
                <tr><td className="sub">1. Kasbon</td><td /><td className="n">{rp(s.potKasbon)}</td></tr>
                <tr><td className="sub">2. Telat</td><td className="ket">{keteranganTelat(s)}</td><td className="n">{rp(s.potTelat)}</td></tr>
                <tr><td className="sub">3. Libur lebih / tidak masuk</td><td className="ket">{keteranganTidakMasuk(s)}</td><td className="n">{rp(s.potAlpa)}</td></tr>
                <tr><td className="sub">4. Potongan lain</td><td /><td className="n">{rp(s.potLain)}</td></tr>
                <tr className="garis total"><td>TOTAL POTONGAN</td><td /><td className="n">{rp(s.totalPotongan)}</td></tr>
              </tbody></table>
              <div className="bersih"><span>PENDAPATAN BERSIH</span><span>Rp {rp(s.gajiBersih)}</span></div>
              <div className="absen">
                Kehadiran: {s.hadir} dari {s.hariKerja} hari kerja · telat {s.telat}×{s.menitTelat ? ` (${durasi(s.menitTelat)})` : ''} ·{' '}
                {slipPakaiJatah(s) ? `Libur ${s.liburTerpakai} dari jatah ${s.jatahLibur} · periode ${periodeLibur}` : `tidak hadir ${s.alpa} hari`} · izin/sakit/cuti {s.izin} hari
              </div>
            </div>
            <div className="kaki">
              <div className="catatan">{s.catatan && `Catatan: ${s.catatan}`}</div>
              <div className="ttd">
                <div className="kota">{aturan.kotaSlip} {tglSlip}</div>
                <div>{s.nama.toUpperCase()}</div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
