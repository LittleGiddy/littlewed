/** @type {import('next').NextConfig} */
const nextConfig = {
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
        hostname: '*.vercel.app', // ✅ Vercel free plan domain
      },
      {
        protocol: 'https',
        hostname: '*.littlewed.co.tz', // Keep for future production
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
};

module.exports = nextConfig;