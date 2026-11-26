import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    const origin = process.env.BACKEND_ORIGIN || 'http://localhost:8080';
    return [{
      source: '/api/v1/psychoeducation/:path*',
      destination: new URL('/api/v1/psychoeducation/:path*', origin).toString(),
    }];
  },
};

export default nextConfig;
