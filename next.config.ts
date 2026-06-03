import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow images from ImageKit CDN and common external sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
        pathname: '/**',
      },
    ],
  },

  // Expose only safe public env vars to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'BOS',
    NEXT_PUBLIC_CURRENCY_SYMBOL: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? '₹',
  },

  // Required for Neon serverless driver in Edge runtime
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },
};

export default nextConfig;
