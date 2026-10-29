import type { Karyawan } from '@/db/schema';

/** Kolom data karyawan yang hanya boleh dilihat & diubah Admin/HRD. */
export const KOLOM_GAJI = ['gajiPokok', 'upahHarian', 'tarifLemburPerJam', 'tunjanganLoyalitas', 'jenisPekerja', 'jatahLibur'] as const;

/** Data karyawan tanpa kolom gaji (untuk dikirim ke browser Admin absensi). */
export function tanpaGaji(k: Karyawan): Partial<Karyawan> {
  const sisa: Partial<Karyawan> = { ...k };
  for (const c of KOLOM_GAJI) if (c !== 'jenisPekerja') delete sisa[c];
  return sisa;
}
