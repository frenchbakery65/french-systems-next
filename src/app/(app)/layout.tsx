import { Merek } from '@/components/merek';
import { Navigasi } from '@/components/navigasi';
import { PERAN, wajibLogin } from '@/lib/auth/sesi';
import { aksiKeluar } from './aksi';

export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const u = await wajibLogin();
  return (
    <div className="app">
      <Navigasi merek={<Merek />} peran={u.role}>
        <div className="app-user">
          <span><strong>{u.name}</strong><span className="ab-person-sub">{PERAN[u.role as keyof typeof PERAN] ?? u.role}</span></span>
          <form action={aksiKeluar}><button className="ab-btn">Keluar</button></form>
        </div>
      </Navigasi>
      <main className="app-main">{children}</main>
    </div>
  );
}
