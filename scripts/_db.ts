import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';

try { process.loadEnvFile('.env'); } catch { /* .env tidak wajib (mis. di Vercel) */ }

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi.');
  process.exit(1);
}

export const klien = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {}, connection: { TimeZone: 'UTC' } });
export const db = drizzle({ client: klien, schema });
export { schema };
