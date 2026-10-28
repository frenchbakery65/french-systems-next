CREATE TABLE "departemen" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departemen_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "hari_libur" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" date NOT NULL,
	"keterangan" varchar(150) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hari_libur_tanggal_unique" UNIQUE("tanggal")
);
--> statement-breakpoint
CREATE TABLE "izin" (
	"id" serial PRIMARY KEY NOT NULL,
	"karyawan_id" integer NOT NULL,
	"jenis" varchar(10) NOT NULL,
	"kurangi_jatah" boolean DEFAULT false NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"keterangan" varchar(255),
	"dibuat_oleh" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jadwal_karyawan" (
	"id" serial PRIMARY KEY NOT NULL,
	"karyawan_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"shift_id" integer,
	"libur" boolean DEFAULT false NOT NULL,
	"catatan" varchar(255),
	"dibuat_oleh" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jadwal_kerja" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(100) DEFAULT 'Jadwal Kantor' NOT NULL,
	"jam_masuk" time DEFAULT '08:00:00' NOT NULL,
	"jam_pulang" time DEFAULT '17:00:00' NOT NULL,
	"toleransi_telat_menit" smallint DEFAULT 5 NOT NULL,
	"jarak_minimal_pulang_menit" smallint DEFAULT 60 NOT NULL,
	"senin" boolean DEFAULT true NOT NULL,
	"selasa" boolean DEFAULT true NOT NULL,
	"rabu" boolean DEFAULT true NOT NULL,
	"kamis" boolean DEFAULT true NOT NULL,
	"jumat" boolean DEFAULT true NOT NULL,
	"sabtu" boolean DEFAULT false NOT NULL,
	"minggu" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "karyawan" (
	"id" serial PRIMARY KEY NOT NULL,
	"pin" varchar(20) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"departemen_id" integer,
	"shift_id" integer,
	"hari_libur_mingguan" jsonb,
	"jabatan" varchar(100),
	"tanggal_masuk" date,
	"tanggal_keluar" date,
	"aktif" boolean DEFAULT true NOT NULL,
	"catatan" text,
	"jenis_pekerja" varchar(20) DEFAULT 'Bulanan' NOT NULL,
	"gaji_pokok" bigint DEFAULT 0 NOT NULL,
	"upah_harian" bigint DEFAULT 0 NOT NULL,
	"tarif_lembur_per_jam" bigint DEFAULT 0 NOT NULL,
	"uang_makan" bigint DEFAULT 0 NOT NULL,
	"uang_makan_per_hari" boolean DEFAULT false NOT NULL,
	"tunjangan_prestasi" bigint DEFAULT 0 NOT NULL,
	"premi_hadir" bigint DEFAULT 0 NOT NULL,
	"jatah_libur" smallint DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "karyawan_pin_unique" UNIQUE("pin")
);
--> statement-breakpoint
CREATE TABLE "koreksi_absen" (
	"id" serial PRIMARY KEY NOT NULL,
	"karyawan_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"jam_masuk" time,
	"jam_pulang" time,
	"alasan" varchar(255) NOT NULL,
	"dibuat_oleh" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_absen" (
	"id" serial PRIMARY KEY NOT NULL,
	"mesin_id" integer,
	"pin" varchar(20) NOT NULL,
	"waktu_scan" timestamp NOT NULL,
	"verifikasi" varchar(10),
	"status_scan" smallint,
	"sumber" varchar(10) DEFAULT 'mesin' NOT NULL,
	"diterima_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_gagal" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesin" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(100) DEFAULT 'Mesin Utama' NOT NULL,
	"cloud_id" varchar(50),
	"api_token" text,
	"webhook_token" varchar(40) NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"sinkron_terakhir" timestamp with time zone,
	"sinkron_berhasil_terakhir" timestamp with time zone,
	"status_terakhir" varchar(20),
	"pesan_terakhir" text,
	"jumlah_log_di_mesin" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mesin_webhook_token_unique" UNIQUE("webhook_token")
);
--> statement-breakpoint
CREATE TABLE "pengaturan_gaji" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal_tutup_buku" smallint DEFAULT 29 NOT NULL,
	"potongan_telat_per_kali" bigint DEFAULT 2500 NOT NULL,
	"potongan_alpa_per_hari" bigint DEFAULT 0 NOT NULL,
	"lembur_otomatis" boolean DEFAULT true NOT NULL,
	"lembur_minimal_menit" smallint DEFAULT 60 NOT NULL,
	"lembur_pembulatan_menit" smallint DEFAULT 60 NOT NULL,
	"premi_hangus_jika_alpa" boolean DEFAULT true NOT NULL,
	"premi_maks_telat" smallint,
	"prorata_gaji_pokok" boolean DEFAULT true NOT NULL,
	"kota_slip" varchar(60) DEFAULT 'Surabaya' NOT NULL,
	"jam_kerja_per_hari" numeric(4, 2) DEFAULT 9 NOT NULL,
	"hari_per_bulan" smallint DEFAULT 30 NOT NULL,
	"metode_potongan_telat" varchar(10) DEFAULT 'per_jam' NOT NULL,
	"telat_minimal_menit" smallint DEFAULT 60 NOT NULL,
	"telat_pembulatan_menit" smallint DEFAULT 60 NOT NULL,
	"default_izin_kurangi_jatah" boolean DEFAULT true NOT NULL,
	"default_sakit_kurangi_jatah" boolean DEFAULT false NOT NULL,
	"libur_nasional_kurangi_jatah" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periode_gaji" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(60) NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"tanggal_slip" date,
	"status" varchar(10) DEFAULT 'draf' NOT NULL,
	"dihitung_pada" timestamp with time zone,
	"dikunci_oleh" integer,
	"dikunci_pada" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riwayat_sinkron" (
	"id" serial PRIMARY KEY NOT NULL,
	"mesin_id" integer NOT NULL,
	"mulai" timestamp with time zone NOT NULL,
	"selesai" timestamp with time zone,
	"berhasil" boolean DEFAULT false NOT NULL,
	"jumlah_diterima" integer DEFAULT 0 NOT NULL,
	"jumlah_baru" integer DEFAULT 0 NOT NULL,
	"pesan" text
);
--> statement-breakpoint
CREATE TABLE "sesi" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kedaluwarsa" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" serial PRIMARY KEY NOT NULL,
	"kode" varchar(20) NOT NULL,
	"nama" varchar(100) NOT NULL,
	"jam_masuk" time NOT NULL,
	"jam_pulang" time NOT NULL,
	"toleransi_telat_menit" smallint DEFAULT 5 NOT NULL,
	"warna" varchar(20),
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "slip_gaji" (
	"id" serial PRIMARY KEY NOT NULL,
	"periode_gaji_id" integer NOT NULL,
	"karyawan_id" integer NOT NULL,
	"pin" varchar(20) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"departemen" varchar(100),
	"jabatan" varchar(100),
	"jenis_pekerja" varchar(20),
	"upah_harian" bigint DEFAULT 0 NOT NULL,
	"upah_per_jam" bigint DEFAULT 0 NOT NULL,
	"hari_kerja" smallint DEFAULT 0 NOT NULL,
	"hadir" smallint DEFAULT 0 NOT NULL,
	"telat" smallint DEFAULT 0 NOT NULL,
	"menit_telat" integer DEFAULT 0 NOT NULL,
	"menit_telat_dipotong" integer DEFAULT 0 NOT NULL,
	"alpa" smallint DEFAULT 0 NOT NULL,
	"panjang_periode" smallint DEFAULT 0 NOT NULL,
	"jatah_libur" smallint DEFAULT 0 NOT NULL,
	"libur_terpakai" smallint DEFAULT 0 NOT NULL,
	"libur_lebih" smallint DEFAULT 0 NOT NULL,
	"izin" smallint DEFAULT 0 NOT NULL,
	"jam_lembur_otomatis" numeric(6, 2) DEFAULT 0 NOT NULL,
	"jam_lembur_manual" numeric(6, 2),
	"gaji_pokok" bigint DEFAULT 0 NOT NULL,
	"tarif_lembur" bigint DEFAULT 0 NOT NULL,
	"upah_lembur" bigint DEFAULT 0 NOT NULL,
	"pot_pinjaman" bigint DEFAULT 0 NOT NULL,
	"uang_makan" bigint DEFAULT 0 NOT NULL,
	"tunjangan_prestasi" bigint DEFAULT 0 NOT NULL,
	"premi_hadir" bigint DEFAULT 0 NOT NULL,
	"komisi" bigint DEFAULT 0 NOT NULL,
	"bonus" bigint DEFAULT 0 NOT NULL,
	"pot_lain" bigint DEFAULT 0 NOT NULL,
	"pot_5" bigint DEFAULT 0 NOT NULL,
	"pot_kasbon" bigint DEFAULT 0 NOT NULL,
	"pot_telat" bigint DEFAULT 0 NOT NULL,
	"pot_alpa" bigint DEFAULT 0 NOT NULL,
	"subtotal_gaji" bigint DEFAULT 0 NOT NULL,
	"total_penerimaan" bigint DEFAULT 0 NOT NULL,
	"total_kotor" bigint DEFAULT 0 NOT NULL,
	"total_potongan" bigint DEFAULT 0 NOT NULL,
	"gaji_bersih" bigint DEFAULT 0 NOT NULL,
	"catatan" varchar(255),
	"catatan_hitung" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(10) DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "izin" ADD CONSTRAINT "izin_karyawan_id_karyawan_id_fk" FOREIGN KEY ("karyawan_id") REFERENCES "public"."karyawan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "izin" ADD CONSTRAINT "izin_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_karyawan" ADD CONSTRAINT "jadwal_karyawan_karyawan_id_karyawan_id_fk" FOREIGN KEY ("karyawan_id") REFERENCES "public"."karyawan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_karyawan" ADD CONSTRAINT "jadwal_karyawan_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_karyawan" ADD CONSTRAINT "jadwal_karyawan_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_departemen_id_departemen_id_fk" FOREIGN KEY ("departemen_id") REFERENCES "public"."departemen"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karyawan" ADD CONSTRAINT "karyawan_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "koreksi_absen" ADD CONSTRAINT "koreksi_absen_karyawan_id_karyawan_id_fk" FOREIGN KEY ("karyawan_id") REFERENCES "public"."karyawan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "koreksi_absen" ADD CONSTRAINT "koreksi_absen_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_absen" ADD CONSTRAINT "log_absen_mesin_id_mesin_id_fk" FOREIGN KEY ("mesin_id") REFERENCES "public"."mesin"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periode_gaji" ADD CONSTRAINT "periode_gaji_dikunci_oleh_users_id_fk" FOREIGN KEY ("dikunci_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riwayat_sinkron" ADD CONSTRAINT "riwayat_sinkron_mesin_id_mesin_id_fk" FOREIGN KEY ("mesin_id") REFERENCES "public"."mesin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_periode_gaji_id_periode_gaji_id_fk" FOREIGN KEY ("periode_gaji_id") REFERENCES "public"."periode_gaji"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_karyawan_id_karyawan_id_fk" FOREIGN KEY ("karyawan_id") REFERENCES "public"."karyawan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "izin_tanggal" ON "izin" USING btree ("tanggal_mulai","tanggal_selesai");--> statement-breakpoint
CREATE UNIQUE INDEX "jadwal_karyawan_unik" ON "jadwal_karyawan" USING btree ("karyawan_id","tanggal");--> statement-breakpoint
CREATE INDEX "jadwal_karyawan_tanggal" ON "jadwal_karyawan" USING btree ("tanggal");--> statement-breakpoint
CREATE UNIQUE INDEX "koreksi_absen_unik" ON "koreksi_absen" USING btree ("karyawan_id","tanggal");--> statement-breakpoint
CREATE UNIQUE INDEX "log_absen_unik" ON "log_absen" USING btree ("pin","waktu_scan");--> statement-breakpoint
CREATE INDEX "log_absen_waktu" ON "log_absen" USING btree ("waktu_scan");--> statement-breakpoint
CREATE INDEX "login_gagal_idx" ON "login_gagal" USING btree ("username","waktu");--> statement-breakpoint
CREATE UNIQUE INDEX "periode_gaji_unik" ON "periode_gaji" USING btree ("tanggal_mulai","tanggal_selesai");--> statement-breakpoint
CREATE INDEX "riwayat_sinkron_mulai" ON "riwayat_sinkron" USING btree ("mulai");--> statement-breakpoint
CREATE INDEX "sesi_user_idx" ON "sesi" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slip_gaji_unik" ON "slip_gaji" USING btree ("periode_gaji_id","karyawan_id");