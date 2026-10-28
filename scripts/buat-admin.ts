/**
 * Buat user admin, atau ganti password user yang sudah ada.
 *   npm run buat-admin -- <username> <password> ["Nama lengkap"] [admin|hrd|viewer]
 */
import bcrypt from 'bcryptjs';
import { db, klien, schema } from './_db';

const [usernameMentah, password, nama, peran = 'admin'] = process.argv.slice(2);
const username = (usernameMentah ?? '').replace(/\s+/g, '').toLowerCase();
if (!/^[a-z0-9._-]{3,50}$/.test(username) || !password || password.length < 8 || !['admin', 'hrd', 'viewer'].includes(peran)) {
  console.error('Pemakaian: npm run buat-admin -- <username> <password min. 8 karakter> ["Nama"] [admin|hrd|viewer]');
  console.error('Username: huruf kecil, angka, titik, garis bawah, strip; 3–50 karakter.');
  process.exit(1);
}
const passwordHash = await bcrypt.hash(password, 11);
await db.insert(schema.users).values({ username, passwordHash, name: nama || username, role: peran })
  .onConflictDoUpdate({ target: schema.users.username, set: { passwordHash, role: peran, ...(nama ? { name: nama } : {}) } });
console.log(`User "${username}" (${peran}) siap dipakai.`);
await klien.end();
