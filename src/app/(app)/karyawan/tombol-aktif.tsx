'use client';

import { useOptimistic, useTransition } from 'react';
import { ubahAktif } from './aksi';

export function TombolAktif({ id, aktif }: { id: number; aktif: boolean }) {
  const [nilai, setNilai] = useOptimistic(aktif);
  const [, mulai] = useTransition();
  return (
    <input type="checkbox" checked={nilai} aria-label="Aktif" onChange={(e) => {
      const baru = e.target.checked;
      mulai(async () => { setNilai(baru); await ubahAktif(id, baru); });
    }} />
  );
}
