import { Judul } from '@/components/ui';
import { halamanPengelola } from '@/lib/auth/sesi';
import { FormImpor } from './form';

export const metadata = { title: 'Import log dari file' };

export default async function HalamanImpor() {
  await halamanPengelola();
  return (
    <>
      <Judul judul="Import log dari file"
        sub="Cadangan jika mesin tidak bisa terhubung ke jaringan, misalnya data diambil lewat flashdisk lalu diexport dari software bawaan mesin."
        aksi={<a className="ab-btn" href="/api/impor/template">Unduh template Excel</a>} />
      <div className="ab">
        <section className="ab-card"><FormImpor /></section>
        <section className="ab-card">
          <h2 className="ab-card-title">Format yang dikenali</h2>
          <ul className="ab-steps ab-small">
            <li>Judul kolom wajib: <strong>PIN</strong> (atau No. ID, User ID, NIK), <strong>Nama</strong>, dan <strong>Tanggal Waktu</strong> — atau <strong>Tanggal</strong> + <strong>Jam</strong> terpisah. Urutan kolom bebas.</li>
            <li>Opsional: <strong>Status</strong> (Masuk/Pulang/0/1…) dan <strong>Verifikasi</strong>.</li>
            <li>Tanggal boleh 2026-10-01 atau 01/10/2026; jam boleh 07:55 atau 07.55.</li>
            <li>File berisi PIN + Nama saja (tanpa waktu) dibaca sebagai daftar karyawan: karyawan baru ditambahkan, nama sementara diisi.</li>
            <li>Format .xls (Excel lama) belum didukung — simpan ulang sebagai .xlsx atau .csv.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
