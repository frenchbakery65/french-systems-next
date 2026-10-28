/** created_at (timestamp UTC tanpa zona, mode string) → "28 Okt 2026 08.15" (WIB). */
const fmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const waktuCatat = (s: string) => fmt.format(new Date(`${s.replace(' ', 'T')}Z`));
