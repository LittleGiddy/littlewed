import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['sharp'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
      },
      {
        protocol: 'https',
        hostname: '*.littlewed.co.tz',
      },
      {
        protocol: 'https',
        hostname: 'littlewed.co.tz',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'littlewed.co.tz', '*.littlewed.co.tz', 'littlewed-kappa.vercel.app'],
    },
  },
  // ✅ Add turbopack config to silence the warning
  turbopack: {},
};

export default nextConfig;