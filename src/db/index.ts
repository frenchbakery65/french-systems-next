import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Satu koneksi per instance serverless. Di Vercel + Neon pakai URL "pooled" (pgbouncer),
 * karena itu prepared statement dimatikan. postgres() baru tersambung saat query pertama,
 * jadi `next build` tetap jalan tanpa DATABASE_URL.
 */
const g = globalThis as unknown as { klienPg?: ReturnType<typeof postgres> };
g.klienPg ??= postgres(process.env.DATABASE_URL ?? 'postgres://localhost/absensi', { prepare: false, max: 5, idle_timeout: 20, connection: { TimeZone: 'UTC' } });

export const db = drizzle({ client: g.klienPg, schema });

export type Db = typeof db;
export { schema };
