import type { Warna } from '@/lib/absensi/tipe';

export function Judul({ judul, sub, aksi }: { judul: React.ReactNode; sub?: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <header className="app-head">
      <div>
        <h1>{judul}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {aksi && <div className="app-head-actions">{aksi}</div>}
    </header>
  );
}

export function Badge({ warna, children }: { warna: Warna; children: React.ReactNode }) {
  return <span className={`ab-badge ab-badge-${warna}`}>{children}</span>;
}

/** Warna badge dari warna shift. */
export function kelasShift(warna: string | null): Warna {
  switch (warna) {
    case 'success': return 'ok';
    case 'warning': return 'warn';
    case 'danger': return 'bad';
    case 'info': case 'primary': return 'info';
    default: return 'muted';
  }
}

export function Avatar({ nama }: { nama: string }) {
  const teks = nama.trim().split(/\s+/).slice(0, 2).map((b) => b.charAt(0)).join('').toUpperCase();
  return <span className="ab-avatar">{teks}</span>;
}
