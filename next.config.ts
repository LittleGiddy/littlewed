/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
        hostname: '*.littlewed.com', // Keep for future production
      },
      {
        protocol: 'https',
        hostname: 'littlewed.com',
      },
    ],
  },
};

module.exports = nextConfig;