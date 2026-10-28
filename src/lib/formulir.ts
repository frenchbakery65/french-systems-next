import type { z } from 'zod';
import { validTgl } from './tanggal';

/** Hasil aksi formulir: pesan umum + galat per isian. */
export type StateForm = { ok?: boolean; pesan?: string; galat?: Record<string, string> } | null;

export function galatZod(e: z.ZodError): StateForm {
  const galat: Record<string, string> = {};
  for (const i of e.issues) galat[String(i.path[0])] ??= i.message;
  return { pesan: 'Periksa kembali isian yang ditandai.', galat };
}

export const teks = (v: FormDataEntryValue | null) => String(v ?? '').trim();
export const teksAtauNull = (v: FormDataEntryValue | null) => teks(v) || null;
export const angkaAtauNull = (v: FormDataEntryValue | null) => (teks(v) && /^\d+$/.test(teks(v)) ? Number(teks(v)) : null);
export const centang = (v: FormDataEntryValue | null) => v === 'on' || v === 'true' || v === '1';

/** "HH:MM" atau "HH:MM:SS" → "HH:MM:00"; selain itu null. */
export function jamAtauNull(v: FormDataEntryValue | null): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(teks(v));
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:00`;
}

export const tanggalAtauNull = (v: FormDataEntryValue | null) => (validTgl(teks(v)) ? teks(v) : null);

export const sekarangIso = () => new Date().toISOString();
