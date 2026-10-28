import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TombolKonfirmasi } from '@/components/form-ui';
import { Badge, Judul } from '@/components/ui';
import { halamanAdmin, PERAN } from '@/lib/auth/sesi';
import { waktuCatat } from '@/lib/waktu-catat';
import { hapusPengguna } from './aksi';

export const metadata = { title: 'Pengguna' };

export default async function HalamanPengguna() {
  const saya = await halamanAdmin();
  const daftar = await db.select().from(schema.users).orderBy(asc(schema.users.name));
  const jumlahAdmin = daftar.filter((u) => u.role === 'admin').length;
  return (
    <>
      <Judul judul="Pengguna" sub="Akun untuk masuk ke dashboard. Lupa password? Ganti dari sini (tidak ada reset lewat email)."
        aksi={<Link className="ab-btn ab-btn-primary" href="/pengguna/baru">Tambah pengguna</Link>} />
      <div className="ab">
        <section className="ab-card">
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Dibuat</th><th /></tr></thead>
              <tbody>
                {daftar.map((u) => (
                  <tr key={u.id}>
                    <td className="ab-strong">{u.name}{u.id === saya.id && <span className="ab-tag"> Anda</span>}</td>
                    <td className="ab-mono">{u.username}</td>
                    <td><Badge warna={u.role === 'admin' ? 'bad' : u.role === 'hrd' ? 'info' : 'muted'}>{PERAN[u.role as keyof typeof PERAN] ?? u.role}</Badge></td>
                    <td>{waktuCatat(u.createdAt).split(' ').slice(0, 3).join(' ')}</td>
                    <td className="ab-num ab-small">
                      <Link href={`/pengguna/${u.id}`}>Ubah / ganti password</Link>
                      {u.id !== saya.id && !(u.role === 'admin' && jumlahAdmin <= 1) && <>{' · '}
                        <TombolKonfirmasi aksi={hapusPengguna.bind(null, u.id)} kelas="ab-link-btn ab-text-bad" pesan={`Hapus akun ${u.name} (${u.username})?`} />
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
