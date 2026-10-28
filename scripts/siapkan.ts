/** Migrasi + data awal (jadwal umum, pengaturan gaji, shift bawaan). Aman dijalankan berulang. */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, klien, schema } from './_db';

const SHIFT_BAWAAN = [
  ['SUBUH', 'Subuh produksi', '05:30', '14:30', 'info'],
  ['PROD-07', 'Produksi pagi', '07:00', '16:00', 'success'],
  ['TOKO-06', 'Toko pagi', '06:00', '15:00', 'warning'],
  ['NORMAL', 'Normal', '08:00', '17:00', 'gray'],
  ['SIANG', 'Siang', '12:00', '21:00', 'danger'],
] as const;

await migrate(db, { migrationsFolder: 'drizzle' });
if (!(await db.$count(schema.jadwalKerja))) await db.insert(schema.jadwalKerja).values({});
if (!(await db.$count(schema.pengaturanGaji))) await db.insert(schema.pengaturanGaji).values({});
await db.insert(schema.shift)
  .values(SHIFT_BAWAAN.map(([kode, nama, jamMasuk, jamPulang, warna]) => ({ kode, nama, jamMasuk, jamPulang, warna })))
  .onConflictDoNothing();
console.log('Database siap: migrasi, jadwal umum, pengaturan gaji, dan shift bawaan.');

/**
 * Admin pertama dari environment variable (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAMA opsional), mis. di Vercel.
 * Hanya dibuat jika belum ada user sama sekali, jadi tidak pernah menimpa akun yang sudah ada.
 */
if (!(await db.$count(schema.users))) {
  const username = (process.env.ADMIN_USERNAME ?? '').replace(/\s+/g, '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!username && !password) {
    console.log('Belum ada user. Isi ADMIN_USERNAME & ADMIN_PASSWORD lalu deploy ulang, atau: npm run buat-admin -- <username> <password> "<Nama>"');
  } else if (!/^[a-z0-9._-]{3,50}$/.test(username) || password.length < 8) {
    console.error('ADMIN_USERNAME harus 3–50 karakter (huruf kecil, angka, . _ -) dan ADMIN_PASSWORD minimal 8 karakter. Admin belum dibuat.');
  } else {
    const bcrypt = (await import('bcryptjs')).default;
    await db.insert(schema.users).values({ username, name: process.env.ADMIN_NAMA || username, role: 'admin', passwordHash: await bcrypt.hash(password, 11) });
    console.log(`Admin pertama "${username}" dibuat. ADMIN_PASSWORD boleh dihapus dari environment variable sekarang.`);
  }
}
await klien.end();
