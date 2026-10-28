'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormAksi } from '@/components/form-ui';
import type { Karyawan } from '@/db/schema';
import { JENIS_PEKERJA } from '@/lib/absensi/tipe';
import { simpanKaryawan, type StateForm } from './aksi';

const HARI: [number, string][] = [[1, 'Senin'], [2, 'Selasa'], [3, 'Rabu'], [4, 'Kamis'], [5, 'Jumat'], [6, 'Sabtu'], [0, 'Minggu']];
const fmtUang = (n: number) => (n ? n.toLocaleString('id-ID') : '');

interface Props {
  k: Partial<Karyawan> | null;
  departemen: { id: number; nama: string }[];
  shift: { id: number; label: string; aktif: boolean }[];
  jamKerjaPerHari: number;
  pinAwal?: string;
}

function Uang({ name, label, nilai, bantuan, galat }: { name: string; label: string; nilai?: number; bantuan?: string; galat?: string }) {
  const [v, setV] = useState(fmtUang(nilai ?? 0));
  return (
    <label className="ab-field">
      <span>{label}</span>
      <input className="ab-input" name={name} inputMode="numeric" value={v} placeholder="0"
        onChange={(e) => setV(fmtUang(Number(e.target.value.replace(/\D/g, '') || 0)))} aria-invalid={!!galat} />
      {galat ? <small className="ab-error">{galat}</small> : bantuan && <small>{bantuan}</small>}
    </label>
  );
}

export function FormKaryawan({ k, departemen, shift, jamKerjaPerHari, pinAwal }: Props) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanKaryawan.bind(null, k?.id ?? null), null);
  const [jenis, setJenis] = useState(k?.jenisPekerja ?? 'Bulanan');
  const [upahHarian, setUpahHarian] = useState(k?.upahHarian ?? 0);
  const g = state?.galat ?? {};
  const libur = new Set(k?.hariLiburMingguan ?? []);
  const perJam = upahHarian > 0 ? Math.round(upahHarian / Math.max(0.01, jamKerjaPerHari)) : 0;

  return (
    <form onSubmit={kirim} className="ab-form" onChange={(e) => {
      const t = e.target as unknown as HTMLInputElement;
      if (t.name === 'upahHarian') setUpahHarian(Number(t.value.replace(/\D/g, '') || 0));
    }}>
      {state?.pesan && <p className="ab-callout" role="alert">{state.pesan}</p>}
      <section className="ab-card ab-form">
        <div className="ab-form-grid">
          <label className="ab-field">
            <span>PIN di mesin</span>
            <input className="ab-input" name="pin" defaultValue={k?.pin ?? pinAwal} required maxLength={20} aria-invalid={!!g.pin} />
            {g.pin ? <small className="ab-error">{g.pin}</small> : <small>Harus sama persis dengan PIN / No. ID karyawan di mesin absen.</small>}
          </label>
          <label className="ab-field">
            <span>Nama</span>
            <input className="ab-input" name="nama" defaultValue={k?.nama} required maxLength={150} aria-invalid={!!g.nama} />
            {g.nama && <small className="ab-error">{g.nama}</small>}
          </label>
          <label className="ab-field">
            <span>Departemen</span>
            <select className="ab-input" name="departemenId" defaultValue={k?.departemenId ?? ''}>
              <option value="">—</option>
              {departemen.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </label>
          <label className="ab-field">
            <span>…atau departemen baru</span>
            <input className="ab-input" name="departemenBaru" maxLength={100} placeholder="mis. Produksi" />
          </label>
          <label className="ab-field">
            <span>Jabatan</span>
            <input className="ab-input" name="jabatan" defaultValue={k?.jabatan ?? ''} maxLength={100} />
          </label>
        </div>

        <div className="ab-form-section">
          <h3>Shift &amp; libur rutin</h3>
          <div className="ab-form-grid">
            <label className="ab-field">
              <span>Shift bawaan</span>
              <select className="ab-input" name="shiftId" defaultValue={k?.shiftId ?? ''}>
                <option value="">Belum ada (ditebak dari scan)</option>
                {shift.filter((s) => s.aktif || s.id === k?.shiftId).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <small>Tanpa shift, jam kerja ditebak dari scan pertama.</small>
            </label>
            <fieldset className="ab-field" style={{ border: 0, padding: 0, margin: 0 }}>
              <span>Libur rutin</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                {HARI.map(([n, nama]) => (
                  <label key={n} className="ab-check">
                    <input type="checkbox" name="hariLiburMingguan" value={n} defaultChecked={libur.has(n)} disabled={jenis === 'Bulanan'} /> {nama}
                  </label>
                ))}
              </span>
              <small>{jenis === 'Bulanan'
                ? 'Karyawan bulanan bebas memilih hari libur, jadi libur rutin tidak dipakai (diatur lewat jatah libur di bagian Gaji).'
                : 'Kosongkan untuk mengikuti hari kerja di jadwal umum.'}</small>
            </fieldset>
          </div>
        </div>

        <div className="ab-form-section">
          <h3>Masa kerja</h3>
          <div className="ab-form-grid">
            <label className="ab-field">
              <span>Tanggal mulai bekerja</span>
              <input className="ab-input" type="date" name="tanggalMasuk" defaultValue={k?.tanggalMasuk ?? ''} />
              <small>Hari sebelum tanggal ini tidak dihitung sebagai tidak hadir.</small>
            </label>
            <label className="ab-field">
              <span>Tanggal berhenti</span>
              <input className="ab-input" type="date" name="tanggalKeluar" defaultValue={k?.tanggalKeluar ?? ''} aria-invalid={!!g.tanggalKeluar} />
              {g.tanggalKeluar ? <small className="ab-error">{g.tanggalKeluar}</small> : <small>Isi jika karyawan sudah keluar.</small>}
            </label>
            <label className="ab-check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" name="aktif" defaultChecked={k?.aktif ?? true} /> Aktif
            </label>
          </div>
        </div>

        <div className="ab-form-section">
          <h3>Gaji</h3>
          <p className="ab-small ab-muted" style={{ margin: '0 0 10px' }}>Komponen tetap yang dipakai setiap periode gaji. Komisi, bonus, kasbon, dan pinjaman diisi per periode.</p>
          <div className="ab-form-grid">
            <Uang name="gajiPokok" label="Gaji pokok (per bulan)" nilai={k?.gajiPokok} galat={g.gajiPokok} />
            <Uang name="upahHarian" label="Upah harian" nilai={k?.upahHarian} galat={g.upahHarian}
              bantuan={perJam ? `Upah per jam = upah harian ÷ ${jamKerjaPerHari} jam = Rp${perJam.toLocaleString('id-ID')}/jam`
                : `Upah per jam = upah harian ÷ ${jamKerjaPerHari} jam. Jika kosong, dihitung dari gaji pokok.`} />
            <Uang name="tarifLemburPerJam" label="Upah lembur per jam (khusus)" nilai={k?.tarifLemburPerJam} bantuan="Biarkan 0 agar otomatis memakai upah per jam." />
            <label className="ab-field">
              <span>Jenis pekerja</span>
              <select className="ab-input" name="jenisPekerja" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                {JENIS_PEKERJA.map((j) => <option key={j}>{j}</option>)}
              </select>
            </label>
            {jenis === 'Bulanan' ? (
              <label className="ab-field">
                <span>Jatah libur per bulan (hari)</span>
                <input className="ab-input" type="number" name="jatahLibur" min={0} max={31} defaultValue={k?.jatahLibur ?? 2} required aria-invalid={!!g.jatahLibur} />
                {g.jatahLibur ? <small className="ab-error">{g.jatahLibur}</small>
                  : <small>Gaji dihitung fix 30 hari termasuk libur. Libur dalam jatah tidak dipotong; lebih dari jatah dipotong gaji ÷ 30 per hari.</small>}
              </label>
            ) : <input type="hidden" name="jatahLibur" value={k?.jatahLibur ?? 2} />}
            <Uang name="uangMakan" label="Uang makan" nilai={k?.uangMakan} />
            <label className="ab-check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" name="uangMakanPerHari" defaultChecked={k?.uangMakanPerHari ?? false} /> Uang makan dikali hari hadir
            </label>
            <Uang name="tunjanganPrestasi" label="Tunjangan prestasi" nilai={k?.tunjanganPrestasi} />
            {jenis !== 'Harian' ? (
              <Uang name="premiHadir" label="Premi hadir" nilai={k?.premiHadir}
                bantuan={jenis === 'Bulanan' ? 'Karyawan bulanan selalu mendapat premi penuh, tidak hangus walau libur atau tidak masuk.'
                  : 'Bisa hangus sesuai aturan di Pengaturan gaji.'} />
            ) : <input type="hidden" name="premiHadir" value="0" />}
          </div>
        </div>

        <div className="ab-form-section">
          <label className="ab-field">
            <span>Catatan</span>
            <textarea name="catatan" defaultValue={k?.catatan ?? ''} rows={3} />
          </label>
        </div>
      </section>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="ab-btn ab-btn-primary" disabled={menunggu}>{menunggu ? 'Menyimpan…' : 'Simpan'}</button>
        <Link className="ab-btn" href={k?.id ? `/karyawan/${k.id}` : '/karyawan'}>Batal</Link>
      </div>
    </form>
  );
}
