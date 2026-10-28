/** Jalankan migrasi database (folder drizzle/). Aman dijalankan berulang. */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, klien } from './_db';

await migrate(db, { migrationsFolder: 'drizzle' });
console.log('Migrasi selesai.');
await klien.end();
