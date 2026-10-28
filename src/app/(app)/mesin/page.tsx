import { desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db, schema } from '@/db';
import { Judul } from '@/components/ui';
import { adalahAdmin, bisaMengelola, wajibLogin } from '@/lib/auth/sesi';
import { mesinBermasalah } from '@/lib/fingerspot/sinkron';
import { sejak } from '@/lib/tanggal';
import { FormMesin, TombolMesin } from './komponen';

export const metadata = { title: 'Mesin & sinkron' };

const fmtWaktu = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function HalamanMesin() {
  const u = await wajibLogin();
  const admin = adalahAdmin(u);
  const h = await headers();
  const asal = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const [daftar, riwayat] = await Promise.all([
    db.select().from(schema.mesin).orderBy(schema.mesin.id),
    db.select().from(schema.riwayatSinkron).orderBy(desc(schema.riwayatSinkron.mulai), desc(schema.riwayatSinkron.id)).limit(20),
  ]);

  return (
    <>
      <Judul judul="Mesin & sinkron" sub="Scan dari mesin Fingerspot Revo diambil lewat Fingerspot.io." />
      <div className="ab">
        {daftar.map((m) => {
          const buruk = mesinBermasalah(m);
          return (
            <section key={m.id} className="ab-card">
              <div className="ab-device">
                <div className="ab-device-main">
                  <span className={`ab-device-status ${buruk ? 'is-bad' : 'is-ok'}`}><span className={`ab-dot ${buruk ? 'ab-dot-bad' : 'ab-dot-ok'}`} />{buruk ? 'Perlu dicek' : 'Terhubung'}</span>
                  <h2>{m.nama}</h2>
                  <p className="ab-muted">Cloud ID {m.cloudId ?? '—'}{m.aktif ? '' : ' · tidak aktif'}</p>
                  <dl className="ab-kv">
                    <div><dt>Sinkron berhasil terakhir</dt><dd>{sejak(m.sinkronBerhasilTerakhir)}</dd></div>
                    <div><dt>Log dibaca terakhir</dt><dd>{m.jumlahLogDiMesin ?? '—'}</dd></div>
                  </dl>
                  {m.pesanTerakhir && <p className={`ab-device-msg ${m.statusTerakhir === 'gagal' ? 'ab-text-bad' : 'ab-muted'}`}>{m.pesanTerakhir}</p>}
                  {bisaMengelola(u) && <div className="ab-hint">
                    <strong>URL webhook</strong> (pasang di portal Fingerspot.io supaya scan masuk seketika dan nama karyawan terisi otomatis):
                    <div className="ab-mono" style={{ wordBreak: 'break-all', marginTop: 4 }}>{asal}/api/fingerspot/webhook/{m.webhookToken}</div>
                  </div>}
                </div>
                {bisaMengelola(u) && <TombolMesin id={m.id} />}
              </div>
              {admin && <div className="ab-form-section" style={{ marginTop: 16 }}><FormMesin m={m} /></div>}
            </section>
          );
        })}
        {daftar.length === 0 && !admin && <section className="ab-card ab-muted">Belum ada mesin. Minta admin menambahkan mesin.</section>}
        {daftar.length === 0 && admin && (
          <section className="ab-card">
            <h2 className="ab-card-title">Tambah mesin</h2>
            <ol className="ab-steps ab-small">
              <li>Daftarkan mesin di portal Fingerspot.io, lalu salin <strong>Cloud ID</strong> dan <strong>API token</strong>.</li>
              <li>Isi formulir di bawah, lalu tekan <strong>Sinkron sekarang</strong>.</li>
              <li>Pasang URL webhook yang muncul di portal Fingerspot.io.</li>
            </ol>
            <div style={{ marginTop: 14 }}><FormMesin m={null} /></div>
          </section>
        )}
        <section className="ab-card">
          <h2 className="ab-card-title">Riwayat sinkron</h2>
          <ul className="ab-plain">
            {riwayat.length === 0 && <li className="ab-muted">Belum ada riwayat.</li>}
            {riwayat.map((r) => (
              <li key={r.id}><span className={r.berhasil ? 'ab-muted' : 'ab-text-bad'}>{fmtWaktu.format(r.mulai)}</span> · {r.pesan}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
