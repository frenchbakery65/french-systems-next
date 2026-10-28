'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Memuat ulang data halaman secara berkala (tanpa memuat ulang seluruh halaman), saat tab terlihat. */
export function Penyegar({ detik }: { detik: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, detik * 1000);
    return () => clearInterval(id);
  }, [router, detik]);
  return null;
}
