'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type Akses = 'semua' | 'kelola' | 'admin';
const MENU: { grup?: string; href: string; label: string; akses?: Akses }[] = [
  { href: '/', label: 'Hari ini' },
  { href: '/jadwal-shift', label: 'Jadwal shift' },
  { href: '/rekap', label: 'Rekap periode' },
  { href: '/impor', label: 'Import file', akses: 'kelola' },
  { grup: 'Penggajian', href: '/periode-gaji', label: 'Periode gaji', akses: 'kelola' },
  { grup: 'Penggajian', href: '/pengaturan-gaji', label: 'Pengaturan gaji', akses: 'kelola' },
  { grup: 'Data master', href: '/karyawan', label: 'Karyawan' },
  { grup: 'Data master', href: '/departemen', label: 'Departemen' },
  { grup: 'Data master', href: '/izin', label: 'Izin / sakit / cuti' },
  { grup: 'Data master', href: '/koreksi', label: 'Koreksi absen' },
  { grup: 'Data master', href: '/hari-libur', label: 'Hari libur' },
  { grup: 'Data master', href: '/shift', label: 'Shift', akses: 'kelola' },
  { grup: 'Data master', href: '/jadwal-umum', label: 'Pengaturan jadwal umum', akses: 'kelola' },
  { grup: 'Sistem', href: '/mesin', label: 'Mesin & sinkron' },
  { grup: 'Sistem', href: '/log-absen', label: 'Log absen (mentah)' },
  { grup: 'Sistem', href: '/pengguna', label: 'Pengguna', akses: 'admin' },
];

export function Navigasi({ merek, peran, children }: { merek: React.ReactNode; peran: string; children: React.ReactNode }) {
  const path = usePathname();
  const [buka, setBuka] = useState(false);
  const aktif = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  const boleh = (a: Akses = 'semua') => a === 'semua' || (a === 'kelola' ? peran === 'admin' || peran === 'hrd' : peran === 'admin');
  let grupSebelum: string | undefined;
  return (
    <aside className={`app-side${buka ? ' terbuka' : ''}`}>
      {merek}
      <button type="button" className="ab-btn app-menu" aria-expanded={buka} onClick={() => setBuka(!buka)}>Menu</button>
      <nav className="app-nav" aria-label="Menu utama">
        {MENU.filter((m) => boleh(m.akses)).map((m) => {
          const judul = m.grup && m.grup !== grupSebelum ? <p className="app-nav-grup">{m.grup}</p> : null;
          grupSebelum = m.grup ?? grupSebelum;
          return (
            <span key={m.href} style={{ display: 'contents' }}>
              {judul}
              <Link href={m.href} aria-current={aktif(m.href) ? 'page' : undefined} onClick={() => setBuka(false)}>{m.label}</Link>
            </span>
          );
        })}
      </nav>
      {children}
    </aside>
  );
}
