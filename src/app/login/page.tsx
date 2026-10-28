import { redirect } from 'next/navigation';
import { Merek } from '@/components/merek';
import { penggunaSaatIni } from '@/lib/auth/sesi';
import { FormLogin } from './form';

export const metadata = { title: 'Masuk' };

export default async function HalamanLogin() {
  if (await penggunaSaatIni()) redirect('/');
  return (
    <main className="login">
      <div className="login-box">
        <Merek />
        <section className="ab-card">
          <h2 style={{ marginBottom: 14 }}>Masuk</h2>
          <FormLogin />
        </section>
        <p className="ab-footnote" style={{ textAlign: 'center' }}>Lupa password? Hubungi admin untuk mengatur ulang.</p>
      </div>
    </main>
  );
}
