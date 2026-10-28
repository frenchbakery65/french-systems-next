'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { KoreksiAbsen } from '@/db/schema';
import type { StateForm } from '@/lib/formulir';
import { scanAsli, simpanKoreksi } from './aksi';

interface Props {
  kor: KoreksiAbsen | null;
  karyawan: { id: number; nama: string; pin: string; aktif: boolean }[];
  awal?: { karyawanId?: string; tanggal?: string; kembali?: string };
}

export function FormKoreksi({ kor, karyawan, awal }: Props) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanKoreksi.bind(null, kor?.id ?? null), null);
  const [kid, setKid] = useState(String(kor?.karyawanId ?? awal?.karyawanId ?? ''));
  const [tgl, setTgl] = useState(kor?.tanggal ?? awal?.tanggal ?? '');
  const [scan, setScan] = useState('Pilih karyawan dan tanggal untuk melihat scan asli.');
  useEffect(() => {
    let aktif = true;
    scanAsli(Number(kid), tgl).then((t) => aktif && setScan(t)).catch(() => {});
    return () => { aktif = false; };
  }, [kid, tgl]);
  return (
    <form onSubmit={kirim} className="ab-form">
      <section className="ab-card ab-form">
        <p className="ab-small ab-muted" style={{ margin: 0 }}>Koreksi menimpa jam masuk/pulang dari mesin pada tanggal tersebut. Log asli dari mesin tetap disimpan.</p>
        <div className="ab-form-grid">
          <label className="ab-field"><span>Karyawan</span>
            <select className="ab-input" name="karyawanId" value={kid} onChange={(e) => setKid(e.target.value)} required>
              <option value="">— pilih —</option>
              {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama} (PIN {k.pin}){k.aktif ? '' : ' · tidak aktif'}</option>)}
            </select>
            <Galat state={state} nama="karyawanId" />
          </label>
          <label className="ab-field"><span>Tanggal</span>
            <input className="ab-input" type="date" name="tanggal" value={tgl} onChange={(e) => setTgl(e.target.value)} required /><Galat state={state} nama="tanggal" />
          </label>
          <label className="ab-field"><span>Jam masuk</span>
            <input className="ab-input" type="time" name="jamMasuk" defaultValue={kor?.jamMasuk?.slice(0, 5)} />
            {state?.galat?.jamMasuk ? <Galat state={state} nama="jamMasuk" /> : <small>Kosongkan jika tidak diubah.</small>}
          </label>
          <label className="ab-field"><span>Jam pulang</span>
            <input className="ab-input" type="time" name="jamPulang" defaultValue={kor?.jamPulang?.slice(0, 5)} />
            {state?.galat?.jamPulang ? <Galat state={state} nama="jamPulang" /> : <small>Kosongkan jika tidak diubah.</small>}
          </label>
        </div>
        <label className="ab-field"><span>Alasan</span>
          <input className="ab-input" name="alasan" defaultValue={kor?.alasan} required maxLength={255} placeholder="Contoh: lupa scan pulang, sudah dikonfirmasi atasan" />
          <Galat state={state} nama="alasan" />
        </label>
        <div className="ab-hint" style={{ marginTop: 0 }}><strong>Scan asli dari mesin pada tanggal ini:</strong> {scan}</div>
        {awal?.kembali && <input type="hidden" name="kembali" value={awal.kembali} />}
      </section>
      <div style={{ display: 'flex', gap: 8 }}>
        <TombolSimpan menunggu={menunggu} />
        <Link className="ab-btn" href="/koreksi">Batal</Link>
      </div>
    </form>
  );
}
