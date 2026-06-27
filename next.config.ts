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

  // Required for Neon serverless driver in Edge runtime (kept for future
  // adoption — not currently used by prisma.ts, which uses standard
  // PrismaClient over the pooled DATABASE_URL; see DEPLOYMENT.md).
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },

  // PWA-related headers:
  //   - manifest.json needs the correct content-type for browsers to
  //     recognize it as a web app manifest (some hosts serve .json as
  //     octet-stream by default).
  //   - sw.js must NEVER be cached by the browser/CDN — a stale cached
  //     service worker can pin users to an old app shell indefinitely.
  //     Cache-Control: no-cache forces a freshness check on every load.
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
