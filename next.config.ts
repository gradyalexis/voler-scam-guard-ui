import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Output standalone dipakai supaya image docker kecil (lihat Dockerfile).
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  eslint: { ignoreDuringBuilds: true },

  // Header ini dulu dipasang Caddy. Sekarang container dilayani langsung di
  // port 9001, jadi Next yang mengirimkannya — tetap berlaku juga kalau nanti
  // ditaruh lagi di belakang reverse proxy.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          // Dashboard berisi data moderasi — jangan diindeks mesin pencari.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
