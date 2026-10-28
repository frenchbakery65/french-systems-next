'use client';

import {
  Building2, CalendarCog, CalendarDays, CalendarOff, ChartColumn, Clock, FileUp, Fingerprint, House,
  ScrollText, SlidersHorizontal, SquarePen, TreePalm, UserCog, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type Akses = 'semua' | 'kelola' | 'admin';
const MENU: { grup?: string; href: string; label: string; ikon: LucideIcon; akses?: Akses }[] = [
  { href: '/', label: 'Hari ini', ikon: House },
  { href: '/jadwal-shift', label: 'Jadwal shift', ikon: CalendarDays },
  { href: '/rekap', label: 'Rekap periode', ikon: ChartColumn },
  { href: '/impor', label: 'Import file', ikon: FileUp, akses: 'kelola' },
  { grup: 'Penggajian', href: '/periode-gaji', label: 'Periode gaji', ikon: Wallet, akses: 'kelola' },
  { grup: 'Penggajian', href: '/pengaturan-gaji', label: 'Pengaturan gaji', ikon: SlidersHorizontal, akses: 'kelola' },
  { grup: 'Data master', href: '/karyawan', label: 'Karyawan', ikon: Users },
  { grup: 'Data master', href: '/departemen', label: 'Departemen', ikon: Building2 },
  { grup: 'Data master', href: '/izin', label: 'Izin / sakit / cuti', ikon: CalendarOff },
  { grup: 'Data master', href: '/koreksi', label: 'Koreksi absen', ikon: SquarePen },
  { grup: 'Data master', href: '/hari-libur', label: 'Hari libur', ikon: TreePalm },
  { grup: 'Data master', href: '/shift', label: 'Shift', ikon: Clock, akses: 'kelola' },
  { grup: 'Data master', href: '/jadwal-umum', label: 'Pengaturan jadwal umum', ikon: CalendarCog, akses: 'kelola' },
  { grup: 'Sistem', href: '/mesin', label: 'Mesin & sinkron', ikon: Fingerprint },
  { grup: 'Sistem', href: '/log-absen', label: 'Log absen (mentah)', ikon: ScrollText },
  { grup: 'Sistem', href: '/pengguna', label: 'Pengguna', ikon: UserCog, akses: 'admin' },
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
              <Link href={m.href} aria-current={aktif(m.href) ? 'page' : undefined} onClick={() => setBuka(false)}>
                <m.ikon className="app-nav-ikon" aria-hidden />{m.label}
              </Link>
            </span>
          );
        })}
      </nav>
      {children}
    </aside>
  );
}
