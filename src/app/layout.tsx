import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { namaPerusahaanPublik } from '@/lib/merek';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${namaPerusahaanPublik} — Absensi & Gaji`, template: `%s · ${namaPerusahaanPublik}` },
  icons: { icon: '/favicon.png' },
  robots: { index: false, follow: false },
};

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="ab">{children}</body>
    </html>
  );
}
