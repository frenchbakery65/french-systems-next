'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { tambahHari } from '@/lib/tanggal';

export function PilihTanggal({ tanggal, hariIni }: { tanggal: string; hariIni: string }) {
  const router = useRouter();
  const ke = (t: string) => router.push(t >= hariIni ? '/' : `/?tanggal=${t}`);
  return (
    <div className="ab-daynav">
      <button type="button" className="ab-btn ab-btn-ikon" onClick={() => ke(tambahHari(tanggal, -1))} aria-label="Hari sebelumnya"><ChevronLeft aria-hidden /></button>
      <input type="date" className="ab-input" value={tanggal} max={hariIni} aria-label="Pilih tanggal"
        onChange={(e) => e.target.value && ke(e.target.value)} />
      {tanggal !== hariIni && (
        <>
          <button type="button" className="ab-btn ab-btn-ikon" onClick={() => ke(tambahHari(tanggal, 1))} aria-label="Hari berikutnya"><ChevronRight aria-hidden /></button>
          <button type="button" className="ab-btn" onClick={() => ke(hariIni)}>Hari ini</button>
        </>
      )}
    </div>
  );
}
