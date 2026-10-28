'use client';

import { startTransition, useActionState, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import type { StateForm } from '@/lib/formulir';

export function Galat({ state, nama }: { state: StateForm; nama: string }) {
  const g = state?.galat?.[nama];
  return g ? <small className="ab-error">{g}</small> : null;
}

export function PesanForm({ state }: { state: StateForm }) {
  if (!state?.pesan) return null;
  return <p className={state.ok ? 'ab-ok-msg' : 'ab-callout'} role={state.ok ? 'status' : 'alert'}>{state.pesan}</p>;
}

export function TombolSimpan({ label = 'Simpan', proses = 'Menyimpan…', menunggu }: { label?: string; proses?: string; menunggu?: boolean }) {
  const { pending } = useFormStatus();
  const sibuk = menunggu ?? pending;
  return <button className="ab-btn ab-btn-primary" disabled={sibuk}>{sibuk ? proses : label}</button>;
}

/**
 * Seperti useActionState, tetapi isian formulir TIDAK dikosongkan setelah dikirim
 * (React 19 mengosongkan formulir yang memakai prop `action`, sehingga isian hilang saat ada galat validasi).
 * Pakai: <form onSubmit={kirim}> lalu <TombolSimpan menunggu={menunggu} />.
 */
export function useFormAksi<S>(aksi: (state: Awaited<S>, form: FormData) => Promise<S>, awal: Awaited<S>) {
  const [state, jalankan, menunggu] = useActionState<S, FormData>(aksi, awal);
  const kirim = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => jalankan(data));
  };
  return [state, kirim, menunggu] as const;
}

/** Tombol dengan konfirmasi sebelum menjalankan aksi server (mis. hapus). */
export function TombolKonfirmasi({ aksi, pesan, label = 'Hapus', kelas = 'ab-btn ab-btn-bad' }: {
  aksi: () => Promise<unknown>; pesan: string; label?: string; kelas?: string;
}) {
  return (
    <form action={async () => { await aksi(); }} onSubmit={(e) => { if (!confirm(pesan)) e.preventDefault(); }} style={{ display: 'inline' }}>
      <TombolKecil kelas={kelas} label={label} />
    </form>
  );
}

function TombolKecil({ kelas, label }: { kelas: string; label: string }) {
  const { pending } = useFormStatus();
  return <button className={kelas} disabled={pending}>{pending ? '…' : label}</button>;
}
