'use client';

import Link from 'next/link';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { StateForm } from '@/lib/formulir';
import { simpanHariLibur } from './aksi';

export function FormHariLibur({ h }: { h: { id: number; tanggal: string; keterangan: string } | null }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanHariLibur.bind(null, h?.id ?? null), null);
  return (
    <form onSubmit={kirim} className="ab-filters" key={h?.id ?? 'baru'}>
      <label className="ab-field">
        <span>Tanggal</span>
        <input className="ab-input" type="date" name="tanggal" defaultValue={h?.tanggal} required />
        <Galat state={state} nama="tanggal" />
      </label>
      <label className="ab-field" style={{ minWidth: 300, flex: 1 }}>
        <span>Keterangan</span>
        <input className="ab-input" name="keterangan" defaultValue={h?.keterangan} required maxLength={150} placeholder="Contoh: Hari Kemerdekaan RI, Cuti bersama" />
        <Galat state={state} nama="keterangan" />
      </label>
      <span style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
        <TombolSimpan label={h ? 'Simpan' : 'Tambah'} menunggu={menunggu} />
        {h && <Link className="ab-btn" href="/hari-libur">Batal</Link>}
      </span>
    </form>
  );
}
