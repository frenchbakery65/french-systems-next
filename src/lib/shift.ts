/** Warna badge shift yang tersedia. */
export const WARNA_SHIFT = { gray: 'Abu-abu', info: 'Biru', success: 'Hijau', warning: 'Kuning', danger: 'Merah', primary: 'Utama' } as const;

/** "06:00–15:00" */
export const ringkasShift = (s: { jamMasuk: string; jamPulang: string }) => `${s.jamMasuk.slice(0, 5)}–${s.jamPulang.slice(0, 5)}`;
