import type { NextConfig } from 'next';

// Read from env or default to 5MB
const maxFileSizeMB = process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: `${maxFileSizeMB}mb` as `${number}mb`,
    },
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', 'lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
