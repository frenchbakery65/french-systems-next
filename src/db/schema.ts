/**
 * Skema database (Postgres). Nama tabel & kolom sama dengan sistem Laravel lama supaya mudah dibandingkan.
 *
 * Konvensi:
 * - Tanggal disimpan sebagai `date` dan dibaca sebagai teks "YYYY-MM-DD".
 * - Jam disimpan sebagai `time` dan dibaca sebagai teks "HH:MM:SS".
 * - waktu_scan adalah jam dinding Asia/Jakarta (`timestamp` tanpa zona), dibaca sebagai "YYYY-MM-DD HH:MM:SS".
 * - Uang dalam rupiah bulat (bigint).
 */
import {
  bigint, boolean, date, index, integer, jsonb, numeric, pgTable, serial, smallint, text, time, timestamp,
  uniqueIndex, varchar,
} from 'drizzle-orm/pg-core';

const uang = (nama: string) => bigint(nama, { mode: 'number' }).notNull().default(0);
const dibuat = () => timestamp('created_at', { mode: 'string' }).notNull().defaultNow();
const diubah = () => timestamp('updated_at', { mode: 'string' }).notNull().defaultNow();

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 10 }).notNull().default('viewer'), // admin | hrd | viewer
  createdAt: dibuat(),
  updatedAt: diubah(),
});

/** Sesi login. Cookie berisi token acak; yang disimpan hanya hash SHA-256-nya. */
export const sesi = pgTable('sesi', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kedaluwarsa: timestamp('kedaluwarsa', { mode: 'date', withTimezone: true }).notNull(),
  createdAt: dibuat(),
}, (t) => [index('sesi_user_idx').on(t.userId)]);

/** Percobaan login gagal (pembatas: 5 kali per 15 menit per username). */
export const loginGagal = pgTable('login_gagal', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull(),
  waktu: timestamp('waktu', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('login_gagal_idx').on(t.username, t.waktu)]);

export const departemen = pgTable('departemen', {
  id: serial('id').primaryKey(),
  nama: varchar('nama', { length: 100 }).notNull().unique(),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

/** Shift kerja (jam masuk–pulang di hari yang sama; tidak ada shift lewat tengah malam). */
export const shift = pgTable('shift', {
  id: serial('id').primaryKey(),
  kode: varchar('kode', { length: 20 }).notNull().unique(),
  nama: varchar('nama', { length: 100 }).notNull(),
  jamMasuk: time('jam_masuk').notNull(),
  jamPulang: time('jam_pulang').notNull(),
  toleransiTelatMenit: smallint('toleransi_telat_menit').notNull().default(5),
  warna: varchar('warna', { length: 20 }),
  aktif: boolean('aktif').notNull().default(true),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

export const karyawan = pgTable('karyawan', {
  id: serial('id').primaryKey(),
  pin: varchar('pin', { length: 20 }).notNull().unique(), // harus sama dengan PIN di mesin
  nama: varchar('nama', { length: 150 }).notNull(),
  departemenId: integer('departemen_id').references(() => departemen.id, { onDelete: 'set null' }),
  shiftId: integer('shift_id').references(() => shift.id, { onDelete: 'set null' }),
  hariLiburMingguan: jsonb('hari_libur_mingguan').$type<number[] | null>(), // 0 (Minggu) – 6 (Sabtu)
  jabatan: varchar('jabatan', { length: 100 }),
  tanggalMasuk: date('tanggal_masuk', { mode: 'string' }),
  tanggalKeluar: date('tanggal_keluar', { mode: 'string' }),
  aktif: boolean('aktif').notNull().default(true),
  catatan: text('catatan'),
  jenisPekerja: varchar('jenis_pekerja', { length: 20 }).notNull().default('Bulanan'), // Bulanan | Harian | Kontrak | Magang
  gajiPokok: uang('gaji_pokok'),
  upahHarian: uang('upah_harian'),
  tarifLemburPerJam: uang('tarif_lembur_per_jam'),
  tunjanganLoyalitas: uang('tunjangan_loyalitas'), // nominal tetap per bulan, diisi admin
  jatahLibur: smallint('jatah_libur').notNull().default(2),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

/** Jadwal umum (satu baris): cadangan jam kerja untuk karyawan tanpa shift, dan hari kerja bawaan. */
export const jadwalKerja = pgTable('jadwal_kerja', {
  id: serial('id').primaryKey(),
  nama: varchar('nama', { length: 100 }).notNull().default('Jadwal Kantor'),
  jamMasuk: time('jam_masuk').notNull().default('08:00:00'),
  jamPulang: time('jam_pulang').notNull().default('17:00:00'),
  toleransiTelatMenit: smallint('toleransi_telat_menit').notNull().default(5),
  jarakMinimalPulangMenit: smallint('jarak_minimal_pulang_menit').notNull().default(60),
  senin: boolean('senin').notNull().default(true),
  selasa: boolean('selasa').notNull().default(true),
  rabu: boolean('rabu').notNull().default(true),
  kamis: boolean('kamis').notNull().default(true),
  jumat: boolean('jumat').notNull().default(true),
  sabtu: boolean('sabtu').notNull().default(false),
  minggu: boolean('minggu').notNull().default(false),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

/** Jadwal khusus satu karyawan pada satu tanggal: tukar shift atau libur. Menimpa shift bawaan. */
export const jadwalKaryawan = pgTable('jadwal_karyawan', {
  id: serial('id').primaryKey(),
  karyawanId: integer('karyawan_id').notNull().references(() => karyawan.id, { onDelete: 'cascade' }),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  shiftId: integer('shift_id').references(() => shift.id, { onDelete: 'set null' }),
  libur: boolean('libur').notNull().default(false),
  catatan: varchar('catatan', { length: 255 }),
  dibuatOleh: integer('dibuat_oleh').references(() => users.id, { onDelete: 'set null' }),
  createdAt: dibuat(),
  updatedAt: diubah(),
}, (t) => [uniqueIndex('jadwal_karyawan_unik').on(t.karyawanId, t.tanggal), index('jadwal_karyawan_tanggal').on(t.tanggal)]);

export const hariLibur = pgTable('hari_libur', {
  id: serial('id').primaryKey(),
  tanggal: date('tanggal', { mode: 'string' }).notNull().unique(),
  keterangan: varchar('keterangan', { length: 150 }).notNull(),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

export const izin = pgTable('izin', {
  id: serial('id').primaryKey(),
  karyawanId: integer('karyawan_id').notNull().references(() => karyawan.id, { onDelete: 'cascade' }),
  jenis: varchar('jenis', { length: 10 }).notNull(), // sakit | izin | cuti | dinas
  kurangiJatah: boolean('kurangi_jatah').notNull().default(false),
  tanggalMulai: date('tanggal_mulai', { mode: 'string' }).notNull(),
  tanggalSelesai: date('tanggal_selesai', { mode: 'string' }).notNull(),
  keterangan: varchar('keterangan', { length: 255 }),
  dibuatOleh: integer('dibuat_oleh').references(() => users.id, { onDelete: 'set null' }),
  createdAt: dibuat(),
  updatedAt: diubah(),
}, (t) => [index('izin_tanggal').on(t.tanggalMulai, t.tanggalSelesai)]);

export const koreksiAbsen = pgTable('koreksi_absen', {
  id: serial('id').primaryKey(),
  karyawanId: integer('karyawan_id').notNull().references(() => karyawan.id, { onDelete: 'cascade' }),
  tanggal: date('tanggal', { mode: 'string' }).notNull(),
  jamMasuk: time('jam_masuk'),
  jamPulang: time('jam_pulang'),
  alasan: varchar('alasan', { length: 255 }).notNull(),
  dibuatOleh: integer('dibuat_oleh').references(() => users.id, { onDelete: 'set null' }),
  createdAt: dibuat(),
  updatedAt: diubah(),
}, (t) => [uniqueIndex('koreksi_absen_unik').on(t.karyawanId, t.tanggal)]);

/** Mesin Fingerspot (Revo) yang terhubung lewat Fingerspot.io. */
export const mesin = pgTable('mesin', {
  id: serial('id').primaryKey(),
  nama: varchar('nama', { length: 100 }).notNull().default('Mesin Utama'),
  cloudId: varchar('cloud_id', { length: 50 }),
  apiToken: text('api_token'), // terenkripsi (lihat src/lib/enkripsi.ts)
  webhookToken: varchar('webhook_token', { length: 40 }).notNull().unique(),
  aktif: boolean('aktif').notNull().default(true),
  sinkronTerakhir: timestamp('sinkron_terakhir', { mode: 'date', withTimezone: true }),
  sinkronBerhasilTerakhir: timestamp('sinkron_berhasil_terakhir', { mode: 'date', withTimezone: true }),
  statusTerakhir: varchar('status_terakhir', { length: 20 }),
  pesanTerakhir: text('pesan_terakhir'),
  jumlahLogDiMesin: integer('jumlah_log_di_mesin'),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

/** Log mentah dari mesin. Tidak pernah diubah atau dihapus oleh aplikasi. */
export const logAbsen = pgTable('log_absen', {
  id: serial('id').primaryKey(),
  mesinId: integer('mesin_id').references(() => mesin.id, { onDelete: 'set null' }),
  pin: varchar('pin', { length: 20 }).notNull(),
  waktuScan: timestamp('waktu_scan', { mode: 'string' }).notNull(),
  verifikasi: varchar('verifikasi', { length: 10 }),
  statusScan: smallint('status_scan'),
  sumber: varchar('sumber', { length: 10 }).notNull().default('mesin'), // mesin | impor
  diterimaPada: timestamp('diterima_pada', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('log_absen_unik').on(t.pin, t.waktuScan), index('log_absen_waktu').on(t.waktuScan)]);

export const riwayatSinkron = pgTable('riwayat_sinkron', {
  id: serial('id').primaryKey(),
  mesinId: integer('mesin_id').notNull().references(() => mesin.id, { onDelete: 'cascade' }),
  mulai: timestamp('mulai', { mode: 'date', withTimezone: true }).notNull(),
  selesai: timestamp('selesai', { mode: 'date', withTimezone: true }),
  berhasil: boolean('berhasil').notNull().default(false),
  jumlahDiterima: integer('jumlah_diterima').notNull().default(0),
  jumlahBaru: integer('jumlah_baru').notNull().default(0),
  pesan: text('pesan'),
}, (t) => [index('riwayat_sinkron_mulai').on(t.mulai)]);

/** Aturan penggajian (satu baris). Dipakai juga oleh absensi: tutup buku, hari per bulan, jatah libur. */
export const pengaturanGaji = pgTable('pengaturan_gaji', {
  id: serial('id').primaryKey(),
  tanggalTutupBuku: smallint('tanggal_tutup_buku').notNull().default(29), // periode 30 bln lalu s/d 29 bln ini
  potonganTelatPerKali: uang('potongan_telat_per_kali').default(2500),
  potonganAlpaPerHari: uang('potongan_alpa_per_hari'),
  lemburOtomatis: boolean('lembur_otomatis').notNull().default(true),
  lemburMinimalMenit: smallint('lembur_minimal_menit').notNull().default(60),
  lemburPembulatanMenit: smallint('lembur_pembulatan_menit').notNull().default(60),
  uangMakan: uang('uang_makan').default(150000), // per bulan, sama untuk semua karyawan
  prorataGajiPokok: boolean('prorata_gaji_pokok').notNull().default(true),
  kotaSlip: varchar('kota_slip', { length: 60 }).notNull().default('Surabaya'),
  jamKerjaPerHari: numeric('jam_kerja_per_hari', { precision: 4, scale: 2, mode: 'number' }).notNull().default(9),
  hariPerBulan: smallint('hari_per_bulan').notNull().default(30),
  metodePotonganTelat: varchar('metode_potongan_telat', { length: 10 }).notNull().default('per_jam'), // per_jam | per_kali
  telatMinimalMenit: smallint('telat_minimal_menit').notNull().default(60),
  telatPembulatanMenit: smallint('telat_pembulatan_menit').notNull().default(60),
  defaultIzinKurangiJatah: boolean('default_izin_kurangi_jatah').notNull().default(true),
  defaultSakitKurangiJatah: boolean('default_sakit_kurangi_jatah').notNull().default(false),
  liburNasionalKurangiJatah: boolean('libur_nasional_kurangi_jatah').notNull().default(false),
  /** Absensi mulai dicatat sejak tanggal ini; scan & hari sebelumnya (masa uji mesin) diabaikan. null = sejak awal. */
  mulaiPakai: date('mulai_pakai', { mode: 'string' }),
  createdAt: dibuat(),
  updatedAt: diubah(),
});

export const periodeGaji = pgTable('periode_gaji', {
  id: serial('id').primaryKey(),
  nama: varchar('nama', { length: 60 }).notNull(),
  tanggalMulai: date('tanggal_mulai', { mode: 'string' }).notNull(),
  tanggalSelesai: date('tanggal_selesai', { mode: 'string' }).notNull(),
  tanggalSlip: date('tanggal_slip', { mode: 'string' }),
  status: varchar('status', { length: 10 }).notNull().default('draf'), // draf | final
  dihitungPada: timestamp('dihitung_pada', { mode: 'date', withTimezone: true }),
  dikunciOleh: integer('dikunci_oleh').references(() => users.id, { onDelete: 'set null' }),
  dikunciPada: timestamp('dikunci_pada', { mode: 'date', withTimezone: true }),
  createdAt: dibuat(),
  updatedAt: diubah(),
}, (t) => [uniqueIndex('periode_gaji_unik').on(t.tanggalMulai, t.tanggalSelesai)]);

/**
 * Slip menyimpan SALINAN semua angka saat dihitung, supaya slip lama tidak berubah walau gaji pokok / aturan
 * diubah di kemudian hari. (Dipakai mulai Tahap 3; tabel sudah dibuat sekarang supaya skema lengkap.)
 */
export const slipGaji = pgTable('slip_gaji', {
  id: serial('id').primaryKey(),
  periodeGajiId: integer('periode_gaji_id').notNull().references(() => periodeGaji.id, { onDelete: 'cascade' }),
  karyawanId: integer('karyawan_id').notNull().references(() => karyawan.id, { onDelete: 'cascade' }),
  pin: varchar('pin', { length: 20 }).notNull(),
  nama: varchar('nama', { length: 150 }).notNull(),
  departemen: varchar('departemen', { length: 100 }),
  jabatan: varchar('jabatan', { length: 100 }),
  jenisPekerja: varchar('jenis_pekerja', { length: 20 }),
  upahHarian: uang('upah_harian'),
  upahPerJam: uang('upah_per_jam'),
  hariKerja: smallint('hari_kerja').notNull().default(0),
  hadir: smallint('hadir').notNull().default(0),
  telat: smallint('telat').notNull().default(0),
  menitTelat: integer('menit_telat').notNull().default(0),
  menitTelatDipotong: integer('menit_telat_dipotong').notNull().default(0),
  alpa: smallint('alpa').notNull().default(0),
  panjangPeriode: smallint('panjang_periode').notNull().default(0),
  jatahLibur: smallint('jatah_libur').notNull().default(0),
  liburTerpakai: smallint('libur_terpakai').notNull().default(0),
  liburLebih: smallint('libur_lebih').notNull().default(0),
  izin: smallint('izin').notNull().default(0),
  jamLemburOtomatis: numeric('jam_lembur_otomatis', { precision: 6, scale: 2, mode: 'number' }).notNull().default(0),
  jamLemburManual: numeric('jam_lembur_manual', { precision: 6, scale: 2, mode: 'number' }),
  gajiPokok: uang('gaji_pokok'),
  tarifLembur: uang('tarif_lembur'),
  upahLembur: uang('upah_lembur'),
  tunjanganProfesi: uang('tunjangan_profesi'),
  tunjanganLoyalitas: uang('tunjangan_loyalitas'),
  uangMakan: uang('uang_makan'),
  bonus: uang('bonus'),
  potLain: uang('pot_lain'),
  potKasbon: uang('pot_kasbon'),
  potTelat: uang('pot_telat'),
  potAlpa: uang('pot_alpa'),
  totalPenerimaan: uang('total_penerimaan'),
  totalPotongan: uang('total_potongan'),
  gajiBersih: uang('gaji_bersih'),
  catatan: varchar('catatan', { length: 255 }),
  catatanHitung: text('catatan_hitung'),
  createdAt: dibuat(),
  updatedAt: diubah(),
}, (t) => [uniqueIndex('slip_gaji_unik').on(t.periodeGajiId, t.karyawanId)]);

export type Karyawan = typeof karyawan.$inferSelect;
export type Shift = typeof shift.$inferSelect;
export type JadwalKerja = typeof jadwalKerja.$inferSelect;
export type JadwalKaryawan = typeof jadwalKaryawan.$inferSelect;
export type Izin = typeof izin.$inferSelect;
export type KoreksiAbsen = typeof koreksiAbsen.$inferSelect;
export type LogAbsen = typeof logAbsen.$inferSelect;
export type PengaturanGaji = typeof pengaturanGaji.$inferSelect;
export type PeriodeGaji = typeof periodeGaji.$inferSelect;
export type Mesin = typeof mesin.$inferSelect;
export type User = typeof users.$inferSelect;
