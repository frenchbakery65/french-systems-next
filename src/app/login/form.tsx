'use client';

import { useActionState } from 'react';
import { aksiMasuk } from './aksi';

export function FormLogin() {
  const [state, kirim, menunggu] = useActionState(aksiMasuk, null);
  return (
    <form action={kirim} className="ab-form">
      <label className="ab-field">
        <span>Username</span>
        <input className="ab-input" name="username" autoComplete="username" autoCapitalize="none" required autoFocus defaultValue={state?.username} />
      </label>
      <label className="ab-field">
        <span>Password</span>
        <input className="ab-input" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.pesan && <p className="ab-error" role="alert">{state.pesan}</p>}
      <button className="ab-btn ab-btn-primary" disabled={menunggu}>{menunggu ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  );
}
