/**
 * Peran pengguna dan hak aksesnya. Tanpa kode server, supaya menu (client) dan pemeriksaan di server
 * memakai aturan yang sama.
 *
 *   admin   — semua, termasuk pengguna & pengaturan mesin
 *   hrd     — absensi + penggajian
 *   absensi — absensi saja: lihat & ubah absensi, jadwal, izin, koreksi, data karyawan tanpa gaji
 *   viewer  — hanya melihat absensi
 */
export const PERAN = { admin: 'Admin', hrd: 'HRD', absensi: 'Admin absensi', viewer: 'Viewer (hanya melihat)' } as const;
export type Peran = keyof typeof PERAN;

type DenganPeran = { role: string } | null;

/** Boleh mengubah data absensi (jadwal, izin, koreksi, karyawan, shift, mesin). */
export const bisaMengelola = (u: DenganPeran) => u?.role === 'admin' || u?.role === 'hrd' || u?.role === 'absensi';

/** Boleh melihat & mengubah apa pun yang berisi uang: gaji karyawan, periode gaji, slip, pengaturan gaji. */
export const bisaGaji = (u: DenganPeran) => u?.role === 'admin' || u?.role === 'hrd';

export const adalahAdmin = (u: DenganPeran) => u?.role === 'admin';
