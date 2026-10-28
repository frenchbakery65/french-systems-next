'use client';

import Link from 'next/link';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { Shift } from '@/db/schema';
import type { StateForm } from '@/lib/formulir';
import { WARNA_SHIFT } from '@/lib/shift';
import { simpanShift } from './aksi';

export function FormShift({ s }: { s: Shift | null }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanShift.bind(null, s?.id ?? null), null);
  return (
    <form onSubmit={kirim} className="ab-form" key={s?.id ?? 'baru'}>
      <h2>{s ? `Ubah shift ${s.kode}` : 'Shift baru'}</h2>
      <div className="ab-form-grid">
        <label className="ab-field"><span>Kode</span>
          <input className="ab-input" name="kode" defaultValue={s?.kode} required maxLength={20} placeholder="SIANG" />
          <Galat state={state} nama="kode" />{!state?.galat?.kode && <small>Singkat, tampil di Jadwal shift. Contoh: SUBUH, TOKO-06.</small>}
        </label>
        <label className="ab-field"><span>Nama</span>
          <input className="ab-input" name="nama" defaultValue={s?.nama} required maxLength={100} placeholder="Siang" /><Galat state={state} nama="nama" />
        </label>
        <label className="ab-field"><span>Jam masuk</span>
          <input className="ab-input" type="time" name="jamMasuk" defaultValue={s?.jamMasuk.slice(0, 5)} required /><Galat state={state} nama="jamMasuk" />
        </label>
        <label className="ab-field"><span>Jam pulang</span>
          <input className="ab-input" type="time" name="jamPulang" defaultValue={s?.jamPulang.slice(0, 5)} required /><Galat state={state} nama="jamPulang" />
        </label>
        <label className="ab-field"><span>Toleransi telat (menit)</span>
          <input className="ab-input" type="number" name="toleransiTelatMenit" min={0} max={120} defaultValue={s?.toleransiTelatMenit ?? 5} required />
          <Galat state={state} nama="toleransiTelatMenit" />
        </label>
        <label className="ab-field"><span>Warna</span>
          <select className="ab-input" name="warna" defaultValue={s?.warna ?? 'gray'}>
            {Object.entries(WARNA_SHIFT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="ab-check" style={{ alignSelf: 'center' }}>
          <input type="checkbox" name="aktif" defaultChecked={s?.aktif ?? true} />
          <span>Aktif<br /><small className="ab-muted">Shift nonaktif tidak bisa dipilih untuk karyawan baru dan tidak dipakai untuk menebak shift.</small></span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <TombolSimpan label={s ? 'Simpan' : 'Tambah shift'} menunggu={menunggu} />
        {s && <Link className="ab-btn" href="/shift">Batal</Link>}
      </div>
    </form>
  );
}
