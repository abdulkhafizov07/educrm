import type { NextConfig } from 'next';

// Where the Next server proxies /api and /uploads requests. In Docker this is the
// API service hostname (e.g. http://api:4000); locally it defaults to localhost:4000.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
  images: {
    domains: ['localhost'],
  },
  output: 'standalone',
};

export default nextConfig;
