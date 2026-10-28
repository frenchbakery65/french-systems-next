'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { PILIHAN_PERIODE } from '@/lib/absensi/filter';

export function FilterPeriode({ mulai, selesai, departemen }: { mulai: string; selesai: string; departemen?: { id: number; nama: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const q = useSearchParams();
  const [menunggu, mulaiTransisi] = useTransition();
  const periode = q.get('periode') ?? 'bulan_ini';
  const atur = (ubah: Record<string, string | null>) => {
    const p = new URLSearchParams(q);
    for (const [k, v] of Object.entries(ubah)) if (v) p.set(k, v); else p.delete(k);
    mulaiTransisi(() => router.push(`${path}?${p}`));
  };
  return (
    <div className="ab-filters">
      <div className="ab-seg" role="radiogroup" aria-label="Periode">
        {Object.entries(PILIHAN_PERIODE).map(([val, lab]) => (
          <button key={val} type="button" role="radio" aria-checked={periode === val} className={periode === val ? 'ab-on' : ''}
            onClick={() => atur(val === 'kustom' ? { periode: val, mulai, selesai } : { periode: val, mulai: null, selesai: null })}>{lab}</button>
        ))}
      </div>
      {periode === 'kustom' && (
        <span className="ab-range">
          <input type="date" className="ab-input" value={mulai} aria-label="Dari tanggal" onChange={(e) => e.target.value && atur({ mulai: e.target.value })} />
          <span className="ab-muted">s/d</span>
          <input type="date" className="ab-input" value={selesai} aria-label="Sampai tanggal" onChange={(e) => e.target.value && atur({ selesai: e.target.value })} />
        </span>
      )}
      {departemen && departemen.length > 0 && (
        <select className="ab-input" value={q.get('departemen') ?? ''} aria-label="Departemen" onChange={(e) => atur({ departemen: e.target.value || null })}>
          <option value="">Semua departemen</option>
          {departemen.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
        </select>
      )}
      {menunggu && <span className="ab-muted ab-small">Menghitung…</span>}
    </div>
  );
}
