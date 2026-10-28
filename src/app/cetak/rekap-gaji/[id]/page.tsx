import { notFound } from 'next/navigation';
import { halamanPengelola } from '@/lib/auth/sesi';
import { rp } from '@/lib/format';
import { periodeAtau404, slipPeriode } from '@/lib/gaji/muat';
import { segarkan } from '@/lib/gaji/periode-db';
import { desimal, judulPeriode, KOLOM, KOLOM_UANG, LABEL_GRAND, LABEL_TOTAL, selTotal, susun, type Total } from '@/lib/gaji/rekap';
import { namaPerusahaan } from '@/lib/pengaturan';
import { TombolCetak } from '../../tombol';


function BarisTotal({ nilai, label, kelas }: { nilai: Total; label: Record<keyof Total, string>; kelas: string }) {
  return (
    <tr className={kelas}>
      <td colSpan={2} />
      {selTotal(nilai, label).map(([span, jenis, isi], i) => (
        <td key={i} colSpan={span > 1 ? span : undefined} className={jenis === 'nilai' ? 'n' : undefined}>{jenis === 'nilai' ? desimal(isi as number) : isi}</td>
      ))}
    </tr>
  );
}

export default async function CetakRekapGaji({ params }: { params: Promise<{ id: string }> }) {
  await halamanPengelola();
  const awal = await periodeAtau404(Number((await params).id));
  if (!awal) notFound();
  await segarkan(awal);
  const p = (await periodeAtau404(awal.id))!;
  const rekap = susun(await slipPeriode(p.id));
  return (
    <>
      <title>{`Rekap gaji ${p.nama}`}</title>
      <style>{'@page { size: A4 landscape; margin: 8mm; }'}</style>
      <div className="toolbar"><span>Rekap gaji · {p.nama} · {rekap.karyawan.length} karyawan</span><TombolCetak /></div>
      <div className="lembar">
        <div className="kop">
          <div>
            <div className="perusahaan">{namaPerusahaan()}</div>
            <div className="judul">REKAP GAJI KARYAWAN{p.status === 'final' ? '' : ' — DRAF (BELUM FINAL)'}</div>
          </div>
          <div className="periode">{judulPeriode(p.tanggalMulai, p.tanggalSelesai)}</div>
        </div>
        <table>
          <thead><tr>{KOLOM.map((j, i) => <th key={j} className={i > 1 ? 'n' : undefined}>{j}</th>)}</tr></thead>
          {rekap.karyawan.map(({ slip: s, baris: b, total: t }) => (
            <tbody key={s.id}>
              <tr className="b1">
                <td>{b[0]}</td><td>{b[1]}</td><td className="n">{b[2]}</td><td className="n">{b[3]}</td>
                {KOLOM_UANG.map((i) => <td key={i} className="n">{rp(b[i] as number)}</td>)}
              </tr>
              <BarisTotal nilai={t} label={LABEL_TOTAL} kelas="b2" />
            </tbody>
          ))}
          <tfoot>
            <tr className="gran">
              <td colSpan={2}>Gran Total</td><td /><td />
              {KOLOM_UANG.map((i) => <td key={i} className="n">{rp(rekap.gran[i])}</td>)}
            </tr>
            <BarisTotal nilai={rekap.grand} label={LABEL_GRAND} kelas="grand" />
          </tfoot>
        </table>
      </div>
    </>
  );
}
