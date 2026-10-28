import 'server-only';
import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { jadwalUmum, pengaturanGaji } from '../pengaturan';
import { minTgl, sekarang, tambahHari, type Tgl } from '../tanggal';
import { daftarPeriode, rentangPeriode } from './periode';
import { Perhitungan } from './perhitungan';
import type { DataAbsensi, KaryawanAbsen, PeriodeAbsen } from './tipe';

export interface OpsiMuat {
  /** Hanya karyawan departemen ini. */
  departemenId?: number | null;
  /** Hanya karyawan ini (abaikan filter aktif). */
  karyawanId?: number;
  /** Karyawan aktif atau yang keluar setelah tanggal ini (bawaan: awal rentang). */
  terhitungSejak?: Tgl;
  satuPeriode?: boolean;
  /** Hanya karyawan yang sudah masuk paling lambat tanggal ini (hitung gaji). */
  masukSampai?: Tgl;
}

export async function semuaPeriode(): Promise<PeriodeAbsen[]> {
  return db.select({ nama: schema.periodeGaji.nama, tanggalMulai: schema.periodeGaji.tanggalMulai, tanggalSelesai: schema.periodeGaji.tanggalSelesai })
    .from(schema.periodeGaji);
}

/** Periode gaji yang mencakup tanggal (sudah dibuat, atau dari aturan tutup buku). */
export async function periodeUntuk(tgl: Tgl) {
  const [aturan, periode] = await Promise.all([pengaturanGaji(), semuaPeriode()]);
  return rentangPeriode(tgl, periode, aturan.tanggalTutupBuku);
}

/** Muat semua data yang dibutuhkan untuk menghitung absensi rentang [mulai, selesai]. */
export async function muatPerhitungan(mulai: Tgl, selesai: Tgl, opsi: OpsiMuat = {}): Promise<Perhitungan> {
  const [jadwal, aturan, periodeGaji, shift] = await Promise.all([
    jadwalUmum(), pengaturanGaji(), semuaPeriode(), db.select().from(schema.shift),
  ]);
  const periodeJatah = opsi.satuPeriode ? [[mulai, selesai]] : daftarPeriode(mulai, selesai, periodeGaji, aturan.tanggalTutupBuku);
  const awalData = minTgl(mulai, periodeJatah[0][0]);
  const sejak = opsi.terhitungSejak ?? mulai;

  const k = schema.karyawan;
  const filter = [
    opsi.karyawanId
      ? eq(k.id, opsi.karyawanId)
      : or(eq(k.aktif, true), gte(k.tanggalKeluar, sejak)),
    opsi.departemenId ? eq(k.departemenId, opsi.departemenId) : undefined,
    opsi.masukSampai ? or(isNull(k.tanggalMasuk), lte(k.tanggalMasuk, opsi.masukSampai)) : undefined,
  ];
  const karyawan: KaryawanAbsen[] = await db
    .select({
      id: k.id, pin: k.pin, nama: k.nama, departemen: schema.departemen.nama, departemenId: k.departemenId, shiftId: k.shiftId,
      hariLiburMingguan: k.hariLiburMingguan, jenisPekerja: k.jenisPekerja, tanggalMasuk: k.tanggalMasuk, tanggalKeluar: k.tanggalKeluar,
      aktif: k.aktif, jatahLibur: k.jatahLibur, gajiPokok: k.gajiPokok, upahHarian: k.upahHarian,
    })
    .from(k)
    .leftJoin(schema.departemen, eq(schema.departemen.id, k.departemenId))
    .where(and(...filter))
    .orderBy(asc(k.nama));

  const pins = karyawan.map((x) => x.pin);
  const ids = karyawan.map((x) => x.id);
  const kosong = Promise.resolve([] as never[]);
  const [libur, scan, izin, koreksi, jadwalKhusus] = await Promise.all([
    db.select().from(schema.hariLibur).where(and(gte(schema.hariLibur.tanggal, awalData), lte(schema.hariLibur.tanggal, selesai))),
    pins.length
      ? db.select({ pin: schema.logAbsen.pin, waktuScan: schema.logAbsen.waktuScan, statusScan: schema.logAbsen.statusScan })
        .from(schema.logAbsen)
        .where(and(inArray(schema.logAbsen.pin, pins), gte(schema.logAbsen.waktuScan, `${awalData} 00:00:00`), lt(schema.logAbsen.waktuScan, `${tambahHari(selesai, 1)} 00:00:00`)))
        .orderBy(asc(schema.logAbsen.waktuScan))
      : kosong,
    ids.length
      ? db.select().from(schema.izin).where(and(inArray(schema.izin.karyawanId, ids), lte(schema.izin.tanggalMulai, selesai), gte(schema.izin.tanggalSelesai, awalData)))
      : kosong,
    ids.length
      ? db.select().from(schema.koreksiAbsen).where(and(inArray(schema.koreksiAbsen.karyawanId, ids), gte(schema.koreksiAbsen.tanggal, awalData), lte(schema.koreksiAbsen.tanggal, selesai)))
      : kosong,
    ids.length
      ? db.select().from(schema.jadwalKaryawan).where(and(inArray(schema.jadwalKaryawan.karyawanId, ids), gte(schema.jadwalKaryawan.tanggal, awalData), lte(schema.jadwalKaryawan.tanggal, selesai)))
      : kosong,
  ]);

  const data: DataAbsensi = {
    mulai, selesai, sekarang: sekarang(), jadwal, aturan, karyawan, shift, periodeGaji,
    libur: Object.fromEntries(libur.map((h) => [h.tanggal, h.keterangan])),
    scan, izin, koreksi, jadwalKhusus, satuPeriode: opsi.satuPeriode,
  };
  return new Perhitungan(data);
}

/** PIN yang muncul di log tapi belum terdaftar sebagai karyawan (30 hari terakhir). */
export async function pinTidakDikenal(hari = 30) {
  const batas = `${tambahHari(sekarang().tanggal, -hari)} 00:00:00`;
  return db
    .select({ pin: schema.logAbsen.pin, jumlah: sql<number>`count(*)::int`, terakhir: sql<string>`max(${schema.logAbsen.waktuScan})` })
    .from(schema.logAbsen)
    .where(and(gte(schema.logAbsen.waktuScan, batas), sql`${schema.logAbsen.pin} not in (select pin from karyawan)`))
    .groupBy(schema.logAbsen.pin)
    .orderBy(asc(schema.logAbsen.pin));
}
