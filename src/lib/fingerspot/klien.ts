/**
 * Klien API Fingerspot.io untuk mesin Fingerspot Revo (mis. W-230N).
 *
 * Mesin terhubung ke internet lewat WiFi dan mengirim scan ke server Fingerspot.io; aplikasi ini
 * mengambilnya lewat https://developer.fingerspot.io/api/... dengan Bearer token.
 *
 * - get_attlog dan get_device menjawab langsung.
 * - get_all_pin, get_userinfo, dan set_time hanya dijawab "diterima"; hasilnya dikirim
 *   Fingerspot.io ke URL webhook mesin (lihat src/app/api/fingerspot/webhook).
 */
import { maxTgl, minTgl, sekarang, tambahHari, validTgl, ZONA, type Tgl } from '../tanggal';

/** Fingerspot.io menyimpan log 60 hari ke belakang. */
export const MAKS_HARI = 59;

const VERIFIKASI: Record<number, string> = { 1: 'Sidik jari', 2: 'Password', 3: 'Kartu', 4: 'Wajah', 6: 'Vena', 7: 'QR' };

export class MesinError extends Error {}

export interface BarisLog { pin: string; waktu: string; verifikasi: string; status: number | null }

/** "2026-10-28 07:55:00" atau "2026-10-28 07:55" → "2026-10-28 07:55:00"; selain itu null. */
export function parseWaktu(teks: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(teks.trim());
  if (!m || !validTgl(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] ?? 0) > 59) return null;
  return `${m[1]} ${m[2]}:${m[3]}:${m[4] ?? '00'}`;
}

export class KlienFingerspot {
  private url: string;

  constructor(private cloudId: string, private token: string, url = process.env.FINGERSPOT_API_URL || 'https://developer.fingerspot.io', private timeoutMs = 10_000) {
    this.url = url.replace(/\/+$/, '');
  }

  private async kirim(perintah: string, isi: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const body = { trans_id: `${Date.now()}${Math.floor(Math.random() * 900 + 100)}`, cloud_id: this.cloudId, ...isi };
    let res: Response;
    try {
      res = await fetch(`${this.url}/api/${perintah}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs * 2),
        cache: 'no-store',
      });
    } catch {
      throw new MesinError('Tidak bisa terhubung ke server Fingerspot.io. Cek koneksi internet server ini.');
    }
    if (res.status === 401 || res.status === 403) throw new MesinError('API token Fingerspot.io ditolak. Cek API token di Pengaturan mesin.');
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json || json.success !== true) {
      const alasan = json ? (json.message ?? json.error) : null;
      throw new MesinError(`Fingerspot.io menolak perintah ${perintah}${alasan ? `: ${alasan}` : ` (HTTP ${res.status})`}. `
        + 'Pastikan Cloud ID benar dan mesin sudah terdaftar di akun Fingerspot.io.');
    }
    return json;
  }

  /** Log scan dalam rentang tanggal. Fingerspot.io membatasi 2 hari per permintaan, jadi rentang panjang dipecah. */
  async ambilLog(dari: Tgl, sampai: Tgl): Promise<BarisLog[]> {
    dari = maxTgl(dari, tambahHari(sekarang().tanggal, -MAKS_HARI));
    const hasil: BarisLog[] = [];
    for (let awal = dari; awal <= sampai; awal = tambahHari(awal, 2)) {
      const akhir = minTgl(tambahHari(awal, 1), sampai);
      const json = await this.kirim('get_attlog', { start_date: awal, end_date: akhir });
      for (const r of (json.data as Record<string, unknown>[] | undefined) ?? []) {
        const pin = String(r.pin ?? '').trim();
        const waktu = parseWaktu(String(r.scan_date ?? ''));
        if (!pin || !waktu) continue;
        const status = r.status_scan;
        hasil.push({
          pin, waktu,
          verifikasi: VERIFIKASI[Number(r.verify ?? 0)] ?? String(r.verify ?? ''),
          status: status !== null && status !== '' && !Number.isNaN(Number(status)) ? Number(status) : null,
        });
      }
    }
    return hasil;
  }

  async infoMesin(): Promise<Record<string, string>> {
    return ((await this.kirim('get_device')).data as Record<string, string>) ?? {};
  }

  /** Atur zona waktu mesin; jam mesin lalu mengikuti jam server Fingerspot.io. */
  async aturJam() {
    await this.kirim('set_time', { timezone: ZONA });
  }

  /** Minta daftar PIN; hasilnya datang lewat webhook (get_userid_list). */
  async mintaDaftarUser() {
    await this.kirim('get_all_pin');
  }

  /** Minta nama dll. untuk satu PIN; hasilnya datang lewat webhook (get_userinfo). */
  async mintaUser(pin: string) {
    await this.kirim('get_userinfo', { pin });
  }
}
