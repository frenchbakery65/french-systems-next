'use client';

import { useActionState, useRef } from 'react';
import { imporFile, type HasilImpor } from './aksi';

export function FormImpor() {
  const [hasil, kirim, menunggu] = useActionState<HasilImpor, FormData>(imporFile, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={kirim} className="ab-form">
      <label className="ab-field">
        <span>File Excel (.xlsx) atau CSV</span>
        {/* Langsung diimport begitu file dipilih, tanpa perlu klik tombol */}
        <input className="ab-input" type="file" name="file" accept=".xlsx,.xlsm,.csv,.txt" required disabled={menunggu}
          style={{ height: 'auto', padding: 8 }} onChange={() => form.current?.requestSubmit()} />
        <small>File langsung diimport setelah dipilih. Data yang sudah ada (PIN dan waktu scan sama) otomatis dilewati, jadi aman mengimpor file yang sama lebih dari sekali. Maksimal 4 MB.</small>
      </label>
      {menunggu && <p className="ab-muted">Mengimpor…</p>}
      {hasil && !menunggu && (
        <div className={hasil.ok ? 'ab-hint' : 'ab-callout'} role="status" style={{ marginTop: 0 }}>
          <strong>{hasil.judul}</strong>
          {hasil.pesan.map((p) => <p key={p} style={{ margin: '4px 0 0' }}>{p}</p>)}
        </div>
      )}
    </form>
  );
}
