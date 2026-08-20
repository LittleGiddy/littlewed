import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['sharp', '@vercel/og'],
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
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@vercel/og': require.resolve('@vercel/og'),
      };
    }
    return config;
  },
};

export default nextConfig;