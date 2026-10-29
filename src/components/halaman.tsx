import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

/** Navigasi halaman sederhana (?hal=). */
export function Halaman({ hal, ada, href }: { hal: number; ada: boolean; href: (hal: number) => string }) {
  if (hal <= 1 && !ada) return null;
  return (
    <div className="ab-pager">
      {hal > 1 ? <Link className="ab-btn" href={href(hal - 1)}><ChevronLeft aria-hidden />Sebelumnya</Link> : null}
      <span className="ab-muted">Halaman {hal}</span>
      {ada ? <Link className="ab-btn" href={href(hal + 1)}>Berikutnya<ChevronRight aria-hidden /></Link> : null}
    </div>
  );
}

export const nomorHalaman = (v?: string) => Math.max(1, Math.min(10_000, Number(v) || 1));
