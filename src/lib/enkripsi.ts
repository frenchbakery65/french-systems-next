import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** AES-256-GCM dengan kunci dari APP_SECRET. Dipakai untuk API token Fingerspot di database. */
function kunci(): Buffer {
  const rahasia = process.env.APP_SECRET;
  if (!rahasia || rahasia.length < 32) throw new Error('APP_SECRET belum diisi (minimal 32 karakter, lihat .env.example).');
  return createHash('sha256').update(rahasia).digest();
}

export function enkripsi(teks: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', kunci(), iv);
  const isi = Buffer.concat([c.update(teks, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), isi.toString('base64url')].join('.');
}

export function dekripsi(sandi: string): string {
  const [versi, iv, tag, isi] = sandi.split('.');
  if (versi !== 'v1' || !iv || !tag || !isi) throw new Error('Format data terenkripsi tidak dikenal.');
  const d = createDecipheriv('aes-256-gcm', kunci(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(isi, 'base64url')), d.final()]).toString('utf8');
}
