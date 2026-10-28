'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { Izin } from '@/db/schema';
import { IZIN_TANPA_JATAH, JENIS_IZIN } from '@/lib/absensi/tipe';
import type { StateForm } from '@/lib/formulir';
import { simpanIzin } from './aksi';

interface Props {
  iz: Izin | null;
  karyawan: { id: number; nama: string; pin: string; aktif: boolean }[];
  /** Pilihan awal "Mengurangi jatah libur" per jenis (dari Pengaturan gaji). */
  bawaanJatah: Record<string, boolean>;
  awal?: { karyawanId?: string; tanggal?: string; kembali?: string };
}

export function FormIzin({ iz, karyawan, bawaanJatah, awal }: Props) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanIzin.bind(null, iz?.id ?? null), null);
  const [jenis, setJenis] = useState(iz?.jenis ?? '');
  const [kurangi, setKurangi] = useState(iz?.kurangiJatah ?? false);
  return (
    <form onSubmit={kirim} className="ab-form">
      <section className="ab-card ab-form">
        <div className="ab-form-grid">
          <label className="ab-field"><span>Karyawan</span>
            <select className="ab-input" name="karyawanId" defaultValue={iz?.karyawanId ?? awal?.karyawanId ?? ''} required>
              <option value="">— pilih —</option>
              {karyawan.map((k) => <option key={k.id} value={k.id}>{k.nama} (PIN {k.pin}){k.aktif ? '' : ' · tidak aktif'}</option>)}
            </select>
            <Galat state={state} nama="karyawanId" />
          </label>
          <label className="ab-field"><span>Jenis</span>
            <select className="ab-input" name="jenis" value={jenis} required onChange={(e) => { setJenis(e.target.value); setKurangi(bawaanJatah[e.target.value] ?? false); }}>
              <option value="">— pilih —</option>
              {Object.entries(JENIS_IZIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Galat state={state} nama="jenis" />
          </label>
          <label className="ab-field"><span>Tanggal mulai</span>
            <input className="ab-input" type="date" name="tanggalMulai" defaultValue={iz?.tanggalMulai ?? awal?.tanggal} required /><Galat state={state} nama="tanggalMulai" />
          </label>
          <label className="ab-field"><span>Tanggal selesai</span>
            <input className="ab-input" type="date" name="tanggalSelesai" defaultValue={iz?.tanggalSelesai ?? awal?.tanggal} required /><Galat state={state} nama="tanggalSelesai" />
          </label>
        </div>
        {jenis && !IZIN_TANPA_JATAH.includes(jenis) && (
          <label className="ab-check">
            <input type="checkbox" name="kurangiJatah" checked={kurangi} onChange={(e) => setKurangi(e.target.checked)} />
            <span><strong>Mengurangi jatah libur</strong><br /><small className="ab-muted">Untuk karyawan bulanan. Centang = hari ini dihitung sebagai libur dan memakai jatah libur bulanan. Cuti dan dinas luar tidak pernah mengurangi jatah.</small></span>
          </label>
        )}
        <label className="ab-field"><span>Keterangan</span>
          <input className="ab-input" name="keterangan" defaultValue={iz?.keterangan ?? ''} maxLength={255} /><Galat state={state} nama="keterangan" />
        </label>
        {awal?.kembali && <input type="hidden" name="kembali" value={awal.kembali} />}
      </section>
      <div style={{ display: 'flex', gap: 8 }}>
        <TombolSimpan menunggu={menunggu} />
        <Link className="ab-btn" href="/izin">Batal</Link>
      </div>
    </form>
  );
}
