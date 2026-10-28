# French Bakery — Absensi & Gaji (Next.js)

Versi baru dari sistem absensi & gaji (sebelumnya Laravel + Filament), dibuat untuk jalan di **Vercel**.
Aturan hitungnya di-port satu per satu dari sistem lama dan diuji dengan kasus yang sama.

## Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) | Bawaan Vercel; halaman dihitung di server, tanpa API terpisah |
| Bahasa | **TypeScript** (strict) | Salah ketik nama kolom/angka ketahuan sebelum jalan |
| Database | **Postgres** — **Neon** di Vercel, Docker di lokal | Serverless, gratis untuk mulai, cadangan & point-in-time restore otomatis |
| ORM | **Drizzle** | Ringan untuk serverless, skema = kode, migrasi SQL yang bisa dibaca |
| Login | Sesi di database + bcrypt | Username/password seperti sistem lama, tanpa layanan luar, tanpa reset lewat email |
| Validasi | **Zod** | Semua isian formulir dicek di server |
| Tampilan | CSS sistem lama (diport) + **Tailwind CSS 4** | Tampilan sama dengan panel lama, mode gelap otomatis |
| Tes | **Vitest** | Mesin hitung murni (tanpa database), tes cepat |
| Excel | **ExcelJS** | Import .xlsx, template, dan (Tahap 3) export |
| Mesin absen | Fingerspot.io: **webhook** (seketika) + **Vercel Cron** (cadangan) | Lihat “Sinkron mesin” di bawah |

Semua tanggal & jam dihitung di zona **Asia/Jakarta** (server Vercel memakai UTC).

## Tahapan

- **Tahap 1 (selesai):** login & peran (Admin/HRD/Viewer), karyawan, terima scan Fingerspot (webhook + cron + tombol
  sinkron), Hari ini, Rekap periode, detail absen per karyawan, jatah libur bulanan, shift & tebak shift.
  Skema database sudah lengkap untuk semua tahap.
- **Tahap 2 (selesai):** Jadwal shift (klik sel untuk tukar/libur, salin minggu lalu, atur banyak), Shift,
  Izin/sakit/cuti (dengan pilihan "mengurangi jatah libur"), Koreksi absen (menampilkan scan asli), Hari libur,
  Pengaturan jadwal umum, Departemen, Pengguna (khusus Admin), Import file Excel/CSV + template, Log absen (mentah).
- **Tahap 3 (selesai):** Pengaturan gaji, Periode gaji (bulan → tanggal otomatis dari tutup buku, tidak boleh tumpang tindih),
  hitung gaji (jatah libur, prorata 30 hari, telat sebulan, lembur, premi), ubah slip manual (komisi, bonus, kasbon,
  pinjaman, Pot 5, jam lembur manual), kunci/buka kunci, cetak slip 2 per A4, cetak rekap gaji A4 landscape
  (format kertas), Export Excel gaji (Rekap gaji + Rincian) dan rekap absensi (Rekap + Detail Harian + Log Mentah).
  Slip periode draf otomatis dihitung ulang saat ada scan baru (mesin/import) dan saat halaman dibuka.

## Menjalankan di komputer (lokal)

Butuh Node.js 22+ dan Docker (untuk Postgres).

```bash
cp .env.example .env            # isi APP_SECRET & CRON_SECRET (openssl rand -base64 32)
docker compose up -d db         # Postgres lokal
npm install
npm run db:siapkan              # buat tabel + jadwal umum + pengaturan gaji + 5 shift bawaan
npm run buat-admin -- admin passwordku "Admin Toko"
npm run dev                     # buka http://localhost:3000
```

Perintah lain: `npm test` (tes), `npm run typecheck`, `npm run build`,
`npm run buat-admin -- <username> <password> ["Nama"] [admin|hrd|viewer]` (buat user / ganti password).

Mengubah skema: edit `src/db/schema.ts` → `npm run db:generate` → file SQL baru di `drizzle/` → `npm run db:migrate`.

## Pasang di Vercel

1. Simpan folder ini di GitHub (repo private), lalu **Import Project** di vercel.com.
2. Di project Vercel: **Storage → Create Database → Neon (Postgres)**. `DATABASE_URL` terisi otomatis.
3. **Settings → Environment Variables:** isi `APP_SECRET`, `CRON_SECRET`, dan (opsional) `NAMA_PERUSAHAAN`.
   Untuk admin pertama isi juga `ADMIN_USERNAME`, `ADMIN_PASSWORD` (min. 8 karakter), dan `ADMIN_NAMA`.
4. Deploy. Saat build, `vercel-build` menjalankan migrasi + data awal, dan membuat admin pertama jika belum ada user.
5. Login dengan akun itu, lalu hapus `ADMIN_PASSWORD` dari Environment Variables (akun tetap ada). Tidak perlu Node.js di komputer.
6. Buka **Mesin & sinkron**, isi Cloud ID + API token Fingerspot.io, tekan **Sinkron sekarang**, lalu pasang
   **URL webhook** yang tertera di portal Fingerspot.io.

> **Catatan paket Vercel:** paket Hobby (gratis) hanya untuk pemakaian pribadi/non-komersial, dan cron-nya maksimal
> 1×/hari. Scan tetap masuk seketika lewat webhook; cron hanya cadangan. Untuk dipakai resmi oleh usaha, pakai
> paket Pro — lalu jadwal cron di `vercel.json` bisa dipercepat (mis. `*/5 * * * *`) dan isi env
> `BATAS_MESIN_MENIT=15` supaya peringatan “mesin tidak terhubung” lebih cepat muncul.

## Sinkron mesin

- **Webhook** (`/api/fingerspot/webhook/<token>`): Fingerspot.io memberi tahu setiap ada scan → aplikasi langsung
  menarik log terbaru. Juga menerima nama karyawan dari mesin (PIN baru otomatis terisi namanya).
- **Cron** (`/api/cron/sinkron`, dilindungi `CRON_SECRET`): menarik log sejak sinkron terakhir, untuk jaga-jaga
  jika ada webhook yang terlewat. Fingerspot.io hanya menyimpan 60 hari terakhir.
- **Tombol** “Sinkron sekarang” di menu Mesin & sinkron.

Log mentah (`log_absen`) tidak pernah diubah atau dihapus oleh aplikasi; koreksi disimpan terpisah.

## Hak akses

| Peran | Boleh |
|---|---|
| Admin | Semua, termasuk Pengguna dan pengaturan Mesin (Cloud ID / API token) |
| HRD | Karyawan, izin, koreksi, jadwal shift, shift, hari libur, jadwal umum, departemen, import, tombol sinkron |
| Viewer | Hanya melihat |

## Struktur

```
src/db/schema.ts              skema database (nama tabel & kolom sama dengan sistem lama)
src/lib/absensi/              mesin hitung absensi: perhitungan, jadwal/shift, jatah libur, periode
src/lib/gaji/                  rumus slip, rekap gaji format kertas, simpan/hitung ulang periode
src/lib/excel.ts              export Excel
src/app/cetak/                halaman cetak slip & rekap gaji (Cetak / Simpan PDF dari browser)
src/lib/fingerspot/           klien Fingerspot.io + sinkron
src/lib/auth/sesi.ts          login, sesi, peran
src/app/(app)/                halaman setelah login
src/app/api/                  webhook & cron
tests/                        tes (port dari tes PHPUnit sistem lama)
scripts/                      migrasi, data awal, buat admin
```
