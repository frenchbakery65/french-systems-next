import { namaPerusahaanPublik } from '@/lib/merek';

export function Merek() {
  return (
    <span className="ab-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-french-bakery.png" alt="" className="ab-brand-logo" />
      <span className="ab-brand-text">
        <span className="ab-brand-name">{namaPerusahaanPublik}</span>
        <span className="ab-brand-sub">Absensi &amp; Gaji</span>
      </span>
    </span>
  );
}
