'use client';

import { useState } from 'react';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import { rentangUntuk } from '@/lib/absensi/periode';
import type { StateForm } from '@/lib/formulir';
import { tambahHari } from '@/lib/tanggal';
import { buatPeriode } from './aksi';

const fmtBulan = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export function FormPeriode({ tutupBuku, bulanIni }: { tutupBuku: number; bulanIni: string }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(buatPeriode, null);
  // 14 bulan: bulan depan s/d 12 bulan lalu
  const bulan = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.UTC(+bulanIni.slice(0, 4), +bulanIni.slice(5, 7) - i, 1));
    return d.toISOString().slice(0, 10);
  });
  const isi = (b: string) => {
    const [m, s] = rentangUntuk(tutupBuku, b);
    return { nama: fmtBulan.format(Date.parse(b)), tanggalMulai: m, tanggalSelesai: s, tanggalSlip: tambahHari(s, 1) };
  };
  const [pilih, setPilih] = useState(`${bulanIni.slice(0, 7)}-01`);
  const [nilai, setNilai] = useState(isi(pilih));
  const ubah = (k: keyof typeof nilai) => (e: React.ChangeEvent<HTMLInputElement>) => setNilai({ ...nilai, [k]: e.target.value });
  return (
    <form onSubmit={kirim} className="ab-form">
      <h2>Buat periode gaji</h2>
      <div className="ab-form-grid">
        <label className="ab-field"><span>Bulan gaji</span>
          <select className="ab-input" value={pilih} onChange={(e) => { setPilih(e.target.value); setNilai(isi(e.target.value)); }}>
            {bulan.map((b) => <option key={b} value={b}>{fmtBulan.format(Date.parse(b))}</option>)}
          </select>
          <small>Tanggal terisi otomatis sesuai tanggal tutup buku di Pengaturan gaji.</small>
        </label>
        <label className="ab-field"><span>Nama</span><input className="ab-input" name="nama" value={nilai.nama} onChange={ubah('nama')} required maxLength={60} /><Galat state={state} nama="nama" /></label>
        <label className="ab-field"><span>Absensi dari</span><input className="ab-input" type="date" name="tanggalMulai" value={nilai.tanggalMulai} onChange={ubah('tanggalMulai')} required /><Galat state={state} nama="tanggalMulai" /></label>
        <label className="ab-field"><span>Absensi sampai</span><input className="ab-input" type="date" name="tanggalSelesai" value={nilai.tanggalSelesai} onChange={ubah('tanggalSelesai')} required /><Galat state={state} nama="tanggalSelesai" /></label>
        <label className="ab-field"><span>Tanggal di slip</span><input className="ab-input" type="date" name="tanggalSlip" value={nilai.tanggalSlip} onChange={ubah('tanggalSlip')} /></label>
      </div>
      <div><TombolSimpan label="Buat & hitung" proses="Menghitung…" menunggu={menunggu} /></div>
    </form>
  );
}
