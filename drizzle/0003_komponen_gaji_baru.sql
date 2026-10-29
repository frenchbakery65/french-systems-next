ALTER TABLE "karyawan" ADD COLUMN "tunjangan_loyalitas" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pengaturan_gaji" ADD COLUMN "uang_makan" bigint DEFAULT 150000 NOT NULL;--> statement-breakpoint
ALTER TABLE "slip_gaji" ADD COLUMN "tunjangan_profesi" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "slip_gaji" ADD COLUMN "tunjangan_loyalitas" bigint DEFAULT 0 NOT NULL;