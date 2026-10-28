import './cetak.css';

/** Halaman cetak (slip & rekap): tanpa sidebar, gaya kertas. */
export default function LayoutCetak({ children }: { children: React.ReactNode }) {
  return <div className="cetak">{children}</div>;
}
