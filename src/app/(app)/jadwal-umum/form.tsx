'use client';

import { Galat, PesanForm, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { JadwalKerja } from '@/db/schema';
import type { StateForm } from '@/lib/formulir';
import { simpanJadwalUmum } from './aksi';

const HARI = [['senin', 'Senin'], ['selasa', 'Selasa'], ['rabu', 'Rabu'], ['kamis', 'Kamis'], ['jumat', 'Jumat'], ['sabtu', 'Sabtu'], ['minggu', 'Minggu']] as const;

export function FormJadwalUmum({ j }: { j: JadwalKerja }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanJadwalUmum, null);
  return (
    <form onSubmit={kirim} className="ab-form">
      <section className="ab-card ab-form">
        <h2>Jam kerja</h2>
        <p className="ab-small ab-muted" style={{ margin: 0 }}>Dipakai untuk karyawan yang belum punya shift (jika shift tidak bisa ditebak dari scan).</p>
        <div className="ab-form-grid">
          <label className="ab-field"><span>Jam masuk</span><input className="ab-input" type="time" name="jamMasuk" defaultValue={j.jamMasuk.slice(0, 5)} required /><Galat state={state} nama="jamMasuk" /></label>
          <label className="ab-field"><span>Jam pulang</span><input className="ab-input" type="time" name="jamPulang" defaultValue={j.jamPulang.slice(0, 5)} required /><Galat state={state} nama="jamPulang" /></label>
          <label className="ab-field"><span>Toleransi telat (menit)</span>
            <input className="ab-input" type="number" name="toleransiTelatMenit" min={0} max={240} defaultValue={j.toleransiTelatMenit} required />
            <Galat state={state} nama="toleransiTelatMenit" />{!state?.galat?.toleransiTelatMenit && <small>Datang sampai jam masuk + toleransi masih dianggap tepat waktu.</small>}
          </label>
        </div>
        <div className="ab-form-section">
          <h3>Hari kerja</h3>
          <p className="ab-small ab-muted" style={{ margin: '0 0 8px' }}>Untuk karyawan non-bulanan yang tidak mengisi libur rutin sendiri.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
            {HARI.map(([k, label]) => <label key={k} className="ab-check"><input type="checkbox" name={k} defaultChecked={j[k]} /> {label}</label>)}
          </div>
        </div>
        <div className="ab-form-section">
          <h3>Lanjutan</h3>
          <label className="ab-field" style={{ maxWidth: 420 }}><span>Jarak minimal scan pulang (menit)</span>
            <input className="ab-input" type="number" name="jarakMinimalPulangMenit" min={1} max={720} defaultValue={j.jarakMinimalPulangMenit} required />
            <Galat state={state} nama="jarakMinimalPulangMenit" />
            <small>Dipakai jika mesin tidak mengirim status Masuk/Pulang. Scan terakhir baru dianggap &quot;pulang&quot; jika berjarak minimal sekian menit dari scan pertama.</small>
          </label>
        </div>
      </section>
      <PesanForm state={state} />
      <div><TombolSimpan menunggu={menunggu} /></div>
    </form>
  );
}
