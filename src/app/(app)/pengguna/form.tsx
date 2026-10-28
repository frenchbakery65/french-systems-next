'use client';

import Link from 'next/link';
import { Galat, TombolSimpan, useFormAksi } from '@/components/form-ui';
import type { StateForm } from '@/lib/formulir';
import { simpanPengguna } from './aksi';

const PERAN = { admin: 'Admin', hrd: 'HRD', viewer: 'Viewer (hanya melihat)' };

export function FormPengguna({ u, diriSendiri }: { u: { id: number; name: string; username: string; role: string } | null; diriSendiri: boolean }) {
  const [state, kirim, menunggu] = useFormAksi<StateForm>(simpanPengguna.bind(null, u?.id ?? null), null);
  return (
    <form onSubmit={kirim} className="ab-form">
      <section className="ab-card ab-form" style={{ maxWidth: 560 }}>
        <label className="ab-field"><span>Nama</span>
          <input className="ab-input" name="name" defaultValue={u?.name} required maxLength={150} />
          {state?.galat?.name ? <Galat state={state} nama="name" /> : <small>Nama tampilan, contoh: Vero.</small>}
        </label>
        <label className="ab-field"><span>Username (untuk login)</span>
          <input className="ab-input" name="username" defaultValue={u?.username} required maxLength={50} autoCapitalize="none" autoComplete="off" />
          {state?.galat?.username ? <Galat state={state} nama="username" /> : <small>Huruf kecil tanpa spasi, contoh: vero atau hrd.toko</small>}
        </label>
        <label className="ab-field"><span>Peran</span>
          <select className="ab-input" name="role" defaultValue={u?.role ?? 'hrd'} disabled={diriSendiri}>
            {Object.entries(PERAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <small>{diriSendiri ? 'Peran akun sendiri tidak bisa diubah.' : 'HRD: input izin, koreksi, karyawan, libur, import. Viewer: hanya melihat. Admin: semua, termasuk mesin dan akun.'}</small>
          <Galat state={state} nama="role" />
        </label>
        <label className="ab-field"><span>Password</span>
          <input className="ab-input" type="password" name="password" autoComplete="new-password" required={!u} minLength={8} />
          {state?.galat?.password ? <Galat state={state} nama="password" /> : <small>{u ? 'Kosongkan jika tidak ingin mengganti password.' : 'Minimal 8 karakter.'}</small>}
        </label>
        <label className="ab-field"><span>Ulangi password</span>
          <input className="ab-input" type="password" name="ulang" autoComplete="new-password" required={!u} />
          <Galat state={state} nama="ulang" />
        </label>
      </section>
      <div style={{ display: 'flex', gap: 8 }}>
        <TombolSimpan menunggu={menunggu} />
        <Link className="ab-btn" href="/pengguna">Batal</Link>
      </div>
    </form>
  );
}
