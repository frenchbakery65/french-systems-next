'use client';

import { useState, useTransition } from 'react';
import { useFormAksi } from '@/components/form-ui';
import { aturJam, cekKoneksi, simpanMesin, sinkronSekarang, tarikUser, type Hasil } from './aksi';

function Pesan({ h }: { h: Hasil }) {
  if (!h) return null;
  return <p className={h.ok ? 'ab-ok-msg' : 'ab-error'} role="status">{h.pesan}</p>;
}

export function TombolMesin({ id }: { id: number }) {
  const [hasil, setHasil] = useState<Hasil>(null);
  const [menunggu, mulai] = useTransition();
  const tombol = (label: string, aksi: (id: number) => Promise<Hasil>, utama = false) => (
    <button type="button" className={`ab-btn${utama ? ' ab-btn-primary' : ''}`} disabled={menunggu}
      onClick={() => mulai(async () => setHasil(await aksi(id)))}>{label}</button>
  );
  return (
    <div className="ab-device-actions">
      {tombol(menunggu ? 'Memproses…' : 'Sinkron sekarang', sinkronSekarang, true)}
      {tombol('Cek koneksi', cekKoneksi)}
      {tombol('Samakan jam mesin', aturJam)}
      {tombol('Tarik daftar user', tarikUser)}
      <Pesan h={hasil} />
    </div>
  );
}

export function FormMesin({ m }: { m: { id: number; nama: string; cloudId: string | null; aktif: boolean } | null }) {
  const [state, kirim, menunggu] = useFormAksi<Hasil>(simpanMesin.bind(null, m?.id ?? null), null);
  return (
    <form onSubmit={kirim} className="ab-form">
      <div className="ab-form-grid">
        <label className="ab-field"><span>Nama</span><input className="ab-input" name="nama" defaultValue={m?.nama ?? 'Mesin Utama'} required /></label>
        <label className="ab-field"><span>Cloud ID</span><input className="ab-input" name="cloudId" defaultValue={m?.cloudId ?? ''} required /><small>Lihat di portal Fingerspot.io (biasanya sama dengan SN mesin).</small></label>
        <label className="ab-field">
          <span>API token</span>
          <input className="ab-input" name="apiToken" type="password" autoComplete="off" placeholder={m ? '(tidak diubah)' : ''} required={!m} />
          <small>Disimpan terenkripsi. Kosongkan jika tidak ingin mengganti.</small>
        </label>
        <label className="ab-check" style={{ alignSelf: 'center' }}><input type="checkbox" name="aktif" defaultChecked={m?.aktif ?? true} /> Aktif (ikut sinkron otomatis)</label>
      </div>
      <Pesan h={state} />
      <div><button className="ab-btn ab-btn-primary" disabled={menunggu}>{menunggu ? 'Menyimpan…' : m ? 'Simpan pengaturan' : 'Tambah mesin'}</button></div>
    </form>
  );
}
