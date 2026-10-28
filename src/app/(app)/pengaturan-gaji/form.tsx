'use client';

import { useState } from 'react';
import { Galat, PesanForm, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { PengaturanGaji } from '@/db/schema';
import type { StateForm } from '@/lib/formulir';
import { simpanPengaturanGaji } from './aksi';

const PEMBULATAN = [[60, 'Per 1 jam penuh'], [30, 'Per 30 menit'], [15, 'Per 15 menit'], [1, 'Tidak dibulatkan']] as const;
const fmt = (n: number) => n.toLocaleString('id-ID');

function Uang({ name, nilai }: { name: string; nilai: number }) {
  const [v, setV] = useState(fmt(nilai));
  return <input className="ab-input" name={name} inputMode="numeric" value={v} onChange={(e) => setV(fmt(Number(e.target.value.replace(/\D/g, '') || 0)))} />;
}

export function FormPengaturanGaji({ a }: { a: PengaturanGaji }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanPengaturanGaji, null);
  const [metode, setMetode] = useState(a.metodePotonganTelat);
  const [hari, setHari] = useState(a.hariPerBulan);
  const harian = Math.round(2700000 / Math.max(1, hari));
  const g = (n: string) => <Galat state={state} nama={n} />;
  return (
    <form onSubmit={kirim} className="ab-form">
      <section className="ab-card ab-form">
        <h2>Periode gaji</h2>
        <div className="ab-form-grid">
          <label className="ab-field"><span>Tanggal tutup buku</span>
            <select className="ab-input" name="tanggalTutupBuku" defaultValue={a.tanggalTutupBuku}>
              <option value={0}>Akhir bulan (periode tgl 1 – akhir bulan)</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Tanggal {d}</option>)}
              <option value={29}>Tanggal 29 (contoh: 30 Agu – 29 Sep)</option>
              <option value={30}>Tanggal 30</option>
            </select>
            <small>Periode gaji berakhir pada tanggal ini dan dimulai sehari setelah tanggal yang sama di bulan sebelumnya.</small>
          </label>
          <label className="ab-field"><span>Kota di slip</span><input className="ab-input" name="kotaSlip" defaultValue={a.kotaSlip} required maxLength={60} />{g('kotaSlip')}</label>
        </div>
      </section>

      <section className="ab-card ab-form">
        <h2>Upah per jam</h2>
        <p className="ab-small ab-muted" style={{ margin: 0 }}>Upah per jam = upah harian karyawan ÷ jam kerja per hari. Dipakai untuk lembur dan potongan telat.</p>
        <div className="ab-form-grid">
          <label className="ab-field"><span>Jam kerja per hari (pembagi)</span>
            <input className="ab-input" name="jamKerjaPerHari" type="number" step="0.5" min={1} max={24} defaultValue={a.jamKerjaPerHari} required />
            {g('jamKerjaPerHari')}<small>Contoh: upah harian Rp90.000 ÷ 9 jam = Rp10.000/jam.</small>
          </label>
          <label className="ab-field"><span>Hari per bulan (jika upah harian kosong)</span>
            <input className="ab-input" name="hariPerBulan" type="number" min={1} max={31} value={hari} onChange={(e) => setHari(Number(e.target.value))} required />
            {g('hariPerBulan')}<small>Upah harian = gaji pokok ÷ angka ini. Contoh: Rp2.700.000 ÷ 30 = Rp90.000.</small>
          </label>
        </div>
      </section>

      <section className="ab-card ab-form">
        <h2>Potongan absen</h2>
        <label className="ab-field"><span>Cara potong telat</span>
          <select className="ab-input" name="metodePotonganTelat" value={metode} onChange={(e) => setMetode(e.target.value)}>
            <option value="per_jam">Total jam telat sebulan × upah per jam</option>
            <option value="per_kali">Nominal tetap per kali telat</option>
          </select>
        </label>
        <div className="ab-form-grid">
          {metode === 'per_jam' ? <>
            <label className="ab-field"><span>Mulai dipotong jika total telat sebulan mencapai (menit)</span>
              <input className="ab-input" name="telatMinimalMenit" type="number" min={0} defaultValue={a.telatMinimalMenit} />{g('telatMinimalMenit')}
              <small>Contoh batas 60: total telat 45 mnt → tidak dipotong.</small>
            </label>
            <label className="ab-field"><span>Dibulatkan ke bawah</span>
              <select className="ab-input" name="telatPembulatanMenit" defaultValue={a.telatPembulatanMenit}>{PEMBULATAN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <small>Contoh per 1 jam, upah Rp10.000/jam: telat 1 jam 45 mnt → dipotong 1 jam = Rp10.000.</small>
            </label>
          </> : <>
            <input type="hidden" name="telatMinimalMenit" value={a.telatMinimalMenit} />
            <input type="hidden" name="telatPembulatanMenit" value={a.telatPembulatanMenit} />
            <label className="ab-field"><span>Potongan per kali telat</span><Uang name="potonganTelatPerKali" nilai={a.potonganTelatPerKali} /><small>Contoh Rp2.500: telat 3 kali → Rp7.500.</small></label>
          </>}
          {metode === 'per_jam' && <input type="hidden" name="potonganTelatPerKali" value={a.potonganTelatPerKali} />}
          <label className="ab-field"><span>Potongan per hari tidak hadir (tanpa keterangan)</span>
            <Uang name="potonganAlpaPerHari" nilai={a.potonganAlpaPerHari} />
            <small>Untuk karyawan harian/kontrak/magang. Isi 0 jika tidak ada potongan. Karyawan bulanan memakai jatah libur (lihat di bawah).</small>
          </label>
        </div>
      </section>

      <section className="ab-card ab-form">
        <h2>Libur karyawan bulanan</h2>
        <p className="ab-small ab-muted" style={{ margin: 0 }}>Karyawan bulanan bebas memilih hari libur. Setiap karyawan punya jatah libur per periode gaji (diatur di menu Karyawan, bawaan 2 hari).
          Libur yang melebihi jatah dipotong upah harian (gaji pokok ÷ hari per bulan). Jatah yang tidak terpakai hangus.</p>
        <label className="ab-check"><input type="checkbox" name="defaultIzinKurangiJatah" defaultChecked={a.defaultIzinKurangiJatah} /><span>Izin mengurangi jatah libur (pilihan awal)<br /><small className="ab-muted">Pilihan awal saat mencatat izin. Bisa diubah per catatan.</small></span></label>
        <label className="ab-check"><input type="checkbox" name="defaultSakitKurangiJatah" defaultChecked={a.defaultSakitKurangiJatah} /><span>Sakit mengurangi jatah libur (pilihan awal)<br /><small className="ab-muted">Cuti dan dinas luar tidak pernah mengurangi jatah.</small></span></label>
        <label className="ab-check"><input type="checkbox" name="liburNasionalKurangiJatah" defaultChecked={a.liburNasionalKurangiJatah} /><span>Libur nasional / perusahaan mengurangi jatah<br /><small className="ab-muted">Tidak dicentang = hari libur di menu Hari libur tidak dihitung sebagai hari kerja dan tidak mengurangi jatah. Masuk di hari itu tetap dihitung lembur.</small></span></label>
        <p className="ab-hint" style={{ margin: 0 }}>Contoh: gaji pokok Rp2.700.000, jatah 2 hari → upah harian Rp2.700.000 ÷ {Math.max(1, hari)} = Rp{fmt(harian)}.
          Libur 2 hari → tidak dipotong. Libur 4 hari → lebih 2 hari → dipotong 2 × Rp{fmt(harian)} = Rp{fmt(2 * harian)}. Gaji pokok tetap sama untuk bulan 28, 30, atau 31 hari.</p>
      </section>

      <section className="ab-card ab-form">
        <h2>Lembur</h2>
        <label className="ab-check"><input type="checkbox" name="lemburOtomatis" defaultChecked={a.lemburOtomatis} /><span>Hitung jam lembur otomatis dari absensi<br /><small className="ab-muted">Lembur = kerja setelah jam pulang (hari kerja) atau seluruh jam kerja di hari libur. Bisa diubah manual per slip.</small></span></label>
        <div className="ab-form-grid">
          <label className="ab-field"><span>Minimal lembur per hari (menit)</span><input className="ab-input" name="lemburMinimalMenit" type="number" min={0} defaultValue={a.lemburMinimalMenit} required />{g('lemburMinimalMenit')}</label>
          <label className="ab-field"><span>Pembulatan ke bawah</span>
            <select className="ab-input" name="lemburPembulatanMenit" defaultValue={a.lemburPembulatanMenit}>{PEMBULATAN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>
      </section>

      <section className="ab-card ab-form">
        <h2>Premi hadir &amp; gaji pokok</h2>
        <label className="ab-check"><input type="checkbox" name="premiHangusJikaAlpa" defaultChecked={a.premiHangusJikaAlpa} /><span>Premi hadir hangus jika ada tidak hadir tanpa keterangan<br /><small className="ab-muted">Untuk karyawan Kontrak/Magang. Bulanan selalu dapat premi penuh walau libur/tidak masuk; Harian tidak dapat premi.</small></span></label>
        <label className="ab-field" style={{ maxWidth: 360 }}><span>Premi hangus jika telat lebih dari (kali)</span>
          <input className="ab-input" name="premiMaksTelat" type="number" min={0} defaultValue={a.premiMaksTelat ?? ''} />{g('premiMaksTelat')}
          <small>Kosongkan jika telat tidak memengaruhi premi.</small>
        </label>
        <label className="ab-check"><input type="checkbox" name="prorataGajiPokok" defaultChecked={a.prorataGajiPokok} /><span>Gaji pokok prorata untuk karyawan baru masuk / keluar di tengah periode<br /><small className="ab-muted">Bulanan: gaji pokok × hari aktif ÷ 30 (apa pun panjang periodenya). Harian/lainnya: menurut hari kerja.</small></span></label>
      </section>
      <PesanForm state={state} />
      <div><TombolSimpan menunggu={menunggu} /></div>
    </form>
  );
}
