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
  // ✅ Include fonts in the serverless function bundle
  outputFileTracingIncludes: {
    '/api/**/*': ['./public/fonts/**'],
  },
  // ✅ Experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'littlewed.co.tz', '*.littlewed.co.tz', 'littlewed-kappa.vercel.app'],
    },
  },
};

export default nextConfig;