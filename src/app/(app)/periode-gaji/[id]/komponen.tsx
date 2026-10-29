'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Galat, PesanForm, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { StateForm } from '@/lib/formulir';
import { bukaKunci, hitungUlang, kunci, ubahSlip } from '../aksi';

export function AksiPeriode({ id, final, admin }: { id: number; final: boolean; admin: boolean }) {
  const [pesan, setPesan] = useState('');
  const [menunggu, mulai] = useTransition();
  const jalan = (tanya: string, kerja: () => Promise<unknown>) => () => {
    if (!confirm(tanya)) return;
    mulai(async () => { const h = await kerja(); setPesan(typeof h === 'string' ? h : ''); });
  };
  return (
    <>
      {!final && <button type="button" className="ab-btn ab-btn-primary" disabled={menunggu}
        onClick={jalan('Angka absensi, lembur, uang makan, tunjangan loyalitas, dan potongan absen dihitung ulang. Isian manual (tunjangan profesi, bonus, kasbon, potongan lain, jam lembur manual) tidak berubah. Lanjutkan?', () => hitungUlang(id))}>
        {menunggu ? 'Memproses…' : 'Hitung ulang dari absensi'}</button>}
      {!final && <button type="button" className="ab-btn" disabled={menunggu}
        onClick={jalan('Kunci periode ini? Setelah dikunci, angka gaji tidak bisa diubah atau dihitung ulang. Lakukan setelah semua slip dicek.', () => kunci(id))}>Kunci (final)</button>}
      {final && admin && <button type="button" className="ab-btn" disabled={menunggu}
        onClick={jalan('Buka kunci? Hanya lakukan jika ada kesalahan. Slip yang sudah dibagikan ke karyawan mungkin akan berbeda.', () => bukaKunci(id))}>Buka kunci</button>}
      <a className="ab-btn" href={`/api/ekspor/gaji/${id}`}>Export Excel</a>
      <a className="ab-btn" href={`/cetak/rekap-gaji/${id}`} target="_blank" rel="noreferrer">Cetak rekap gaji</a>
      <a className="ab-btn" href={`/cetak/slip/${id}`} target="_blank" rel="noreferrer">Cetak semua slip</a>
      {pesan && <span className="ab-ok-msg" role="status" style={{ alignSelf: 'center' }}>{pesan}</span>}
    </>
  );
}

export interface DataUbah {
  id: number; nama: string; tunjanganProfesi: number; bonus: number; potKasbon: number; potLain: number;
  jamLemburManual: number | null; jamOtomatis: string; catatan: string | null;
}

const fmt = (n: number) => (n ? n.toLocaleString('id-ID') : '');

function Uang({ name, label, nilai }: { name: string; label: string; nilai: number }) {
  const [v, setV] = useState(fmt(nilai));
  return (
    <label className="ab-field"><span>{label}</span>
      <input className="ab-input" name={name} inputMode="numeric" placeholder="0" value={v} onChange={(e) => setV(fmt(Number(e.target.value.replace(/\D/g, '') || 0)))} />
    </label>
  );
}

export function UbahSlip({ d, periodeId }: { d: DataUbah; periodeId: number }) {
  const [buka, setBuka] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const [state, kirim, menunggu] = useFormAksi<StateForm>(ubahSlip.bind(null, d.id, periodeId), null);
  useEffect(() => { if (buka) ref.current?.showModal(); else ref.current?.close(); }, [buka]);
  useEffect(() => { if (state?.ok) setBuka(false); }, [state]);
  return (
    <>
      <button type="button" className="ab-link-btn" onClick={() => setBuka(true)}>Ubah</button>
      <dialog ref={ref} className="ab-dialog" style={{ width: 'min(560px, calc(100vw - 32px))', textAlign: 'left' }} onClose={() => setBuka(false)}>
        <form onSubmit={kirim} className="ab-form">
          <div><h2>Ubah slip — {d.nama}</h2><p className="ab-small ab-muted" style={{ margin: 0 }}>Isi komponen yang berbeda setiap periode. Total dihitung otomatis.</p></div>
          <h3 style={{ margin: 0, fontSize: 13 }}>Penerimaan</h3>
          <div className="ab-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Uang name="tunjanganProfesi" label="Tunjangan profesi" nilai={d.tunjanganProfesi} />
            <Uang name="bonus" label="Bonus" nilai={d.bonus} />
            <label className="ab-field"><span>Jam lembur (manual)</span>
              <input className="ab-input" name="jamLemburManual" inputMode="decimal" defaultValue={d.jamLemburManual ?? ''} placeholder={`otomatis: ${d.jamOtomatis}`} />
              <Galat state={state} nama="jamLemburManual" /><small>Kosongkan untuk memakai hitungan otomatis dari absensi.</small>
            </label>
            <label className="ab-field"><span>Jam lembur dari absensi</span><input className="ab-input" value={`${d.jamOtomatis} jam`} disabled /></label>
          </div>
          <h3 style={{ margin: 0, fontSize: 13 }}>Potongan</h3>
          <div className="ab-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Uang name="potKasbon" label="Kasbon (termasuk cicilan pinjaman)" nilai={d.potKasbon} />
            <Uang name="potLain" label="Potongan lain" nilai={d.potLain} />
          </div>
          <label className="ab-field"><span>Catatan</span><input className="ab-input" name="catatan" defaultValue={d.catatan ?? ''} maxLength={255} placeholder="Contoh: kasbon 10 Sep, cicilan ke-2 dari 5; potongan lain: gelas pecah" /></label>
          {state && !state.ok && <PesanForm state={state} />}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ab-btn" onClick={() => setBuka(false)}>Batal</button>
            <TombolSimpan menunggu={menunggu} />
          </div>
        </form>
      </dialog>
    </>
  );
}
