'use client';

import { useEffect, useRef, useState } from 'react';
import { Galat, PesanForm, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { StateForm } from '@/lib/formulir';
import { aturBanyak, salinMingguLalu, ubahSel } from './aksi';

export type Pilihan = { nilai: string; label: string }[];

function Dialog({ buka, tutup, children }: { buka: boolean; tutup: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (buka && !ref.current?.open) ref.current?.showModal();
    if (!buka && ref.current?.open) ref.current.close();
  }, [buka]);
  return <dialog ref={ref} className="ab-dialog" onClose={tutup}>{children}</dialog>;
}

/** Sel grid jadwal yang bisa diklik untuk tukar shift / libur. */
export function SelJadwal({ karyawanId, nama, tanggal, judulTanggal, awal, catatan, pilihan, kelas, judul, children }: {
  karyawanId: number; nama: string; tanggal: string; judulTanggal: string; awal: string; catatan: string; pilihan: Pilihan;
  kelas: string; judul: string; children: React.ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  const [state, kirim, menunggu] = useFormAksi<StateForm>(ubahSel.bind(null, karyawanId, tanggal), null);
  useEffect(() => { if (state?.ok) setBuka(false); }, [state]);
  return (
    <td className={`${kelas} ab-jadwal-klik`} title={judul} role="button" tabIndex={0}
      onClick={() => setBuka(true)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setBuka(true)}>
      {children}
      <Dialog buka={buka} tutup={() => setBuka(false)}>
        <form onSubmit={kirim} className="ab-form" onClick={(e) => e.stopPropagation()}>
          <div><h2>Jadwal {nama}</h2><p className="ab-dialog-sub">{judulTanggal}</p></div>
          <label className="ab-field"><span>Shift</span>
            <select className="ab-input" name="pilihan" defaultValue={awal}>
              {pilihan.map((p) => <option key={p.nilai} value={p.nilai}>{p.label}</option>)}
            </select>
          </label>
          <label className="ab-field"><span>Catatan</span><input className="ab-input" name="catatan" defaultValue={catatan} maxLength={255} placeholder="Contoh: tukar dengan Budi" /></label>
          {state && !state.ok && <PesanForm state={state} />}
          <div className="ab-dialog-aksi">
            <button type="button" className="ab-btn" onClick={() => setBuka(false)}>Batal</button>
            <TombolSimpan menunggu={menunggu} />
          </div>
        </form>
      </Dialog>
    </td>
  );
}

export function AksiJadwal({ awal, judulMinggu, idKaryawan, karyawan, pilihan }: {
  awal: string; akhir: string; judulMinggu: string; idKaryawan: number[]; karyawan: { id: number; nama: string }[]; pilihan: Pilihan;
}) {
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState<StateForm>(null);
  const [state, kirim, menungguBanyak] = useFormAksi<StateForm>(aturBanyak, null);
  useEffect(() => { if (state?.ok) { setBuka(false); setPesan(state); } }, [state]);
  return (
    <>
      <form action={async () => setPesan(await salinMingguLalu(awal, idKaryawan))}
        onSubmit={(e) => { if (!confirm(`Tukar shift & libur dari minggu sebelumnya disalin ke ${judulMinggu}. Jadwal khusus yang sudah ada di tanggal tujuan ditimpa. Lanjutkan?`)) e.preventDefault(); }}>
        <button className="ab-btn">Salin minggu lalu</button>
      </form>
      <button type="button" className="ab-btn ab-btn-primary" onClick={() => setBuka(true)}>Atur banyak</button>
      {pesan && <span className={pesan.ok ? 'ab-ok-msg' : 'ab-error'} role="status" style={{ alignSelf: 'center' }}>{pesan.pesan}</span>}
      <Dialog buka={buka} tutup={() => setBuka(false)}>
        <form onSubmit={kirim} className="ab-form">
          <h2>Atur jadwal banyak karyawan</h2>
          <label className="ab-field"><span>Karyawan</span>
            <select className="ab-input" name="karyawan" multiple size={Math.min(8, karyawan.length || 1)} style={{ height: 'auto' }}>
              {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <small>Tahan Ctrl / Cmd untuk memilih lebih dari satu.</small><Galat state={state} nama="karyawan" />
          </label>
          <div className="ab-form-grid ab-form-grid-2">
            <label className="ab-field"><span>Dari tanggal</span><input className="ab-input" type="date" name="dari" defaultValue={awal} required /><Galat state={state} nama="dari" /></label>
            <label className="ab-field"><span>Sampai tanggal</span><input className="ab-input" type="date" name="sampai" required /><Galat state={state} nama="sampai" /></label>
          </div>
          <label className="ab-field"><span>Shift</span>
            <select className="ab-input" name="pilihan" required defaultValue="">
              <option value="" disabled>— pilih —</option>
              {pilihan.map((p) => <option key={p.nilai} value={p.nilai}>{p.label}</option>)}
            </select>
            <Galat state={state} nama="pilihan" />
          </label>
          <label className="ab-field"><span>Catatan</span><input className="ab-input" name="catatan" maxLength={255} /></label>
          {state && !state.ok && <PesanForm state={state} />}
          <div className="ab-dialog-aksi">
            <button type="button" className="ab-btn" onClick={() => setBuka(false)}>Batal</button>
            <TombolSimpan label="Terapkan" menunggu={menungguBanyak} />
          </div>
        </form>
      </Dialog>
    </>
  );
}
