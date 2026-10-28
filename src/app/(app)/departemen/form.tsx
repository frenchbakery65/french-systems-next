'use client';

import Link from 'next/link';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { StateForm } from '@/lib/formulir';
import { simpanDepartemen } from './aksi';

export function FormDepartemen({ d }: { d: { id: number; nama: string } | null }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanDepartemen.bind(null, d?.id ?? null), null);
  return (
    <form onSubmit={kirim} className="ab-filters" key={d?.id ?? 'baru'}>
      <label className="ab-field" style={{ minWidth: 260 }}>
        <span>{d ? `Ubah ${d.nama}` : 'Departemen baru'}</span>
        <input className="ab-input" name="nama" defaultValue={d?.nama} required maxLength={100} placeholder="mis. Produksi" />
        <Galat state={state} nama="nama" />
      </label>
      <span style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
        <TombolSimpan label={d ? 'Simpan' : 'Tambah'} menunggu={menunggu} />
        {d && <Link className="ab-btn" href="/departemen">Batal</Link>}
      </span>
    </form>
  );
}
