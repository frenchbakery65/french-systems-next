/** "8j 05m" (jam kerja); 0 → "0j". */
export function formatDurasi(menit: number): string {
  if (!menit) return '0j';
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return j ? `${j}j ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** "1j 5m", "45m"; 0 → "". */
export function formatMenit(n: number): string {
  if (!n) return '';
  if (n >= 60) {
    const j = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${j}j ${m}m` : `${j}j`;
  }
  return `${n}m`;
}

/** "1 jam 45 mnt" (durasi telat di slip & Hari ini). */
export function durasi(menit: number): string {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return [j ? `${j} jam` : '', m || !j ? `${m} mnt` : ''].filter(Boolean).join(' ');
}

/** "HH:MM" atau "—". */
export const jam = (j: string | null) => (j ? j.slice(0, 5) : '—');

/** 2300000 → "2.300.000"; dengan simbol → "Rp 2.300.000". */
export function rp(n: number | null | undefined, simbol = false): string {
  const t = Math.round(Number(n) || 0).toLocaleString('id-ID');
  return simbol ? `Rp ${t}` : t;
}

/** "Budi Santoso" → "BS". */
export function inisial(nama: string): string {
  return nama.trim().split(/\s+/).slice(0, 2).map((b) => b.charAt(0)).join('').toUpperCase();
}
