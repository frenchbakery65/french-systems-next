import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Semua jam dihitung di zona Asia/Jakarta (lihat src/lib/tanggal.ts), bukan zona server Vercel (UTC).
  serverExternalPackages: ['postgres', 'exceljs'],
  // Import file Excel/CSV lewat Server Action (Vercel membatasi ±4,5 MB per permintaan)
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};

export default nextConfig;
