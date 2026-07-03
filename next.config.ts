// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js 15: serverComponentsExternalPackages moved out of experimental
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ik.imagekit.io' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  // Allow cross-origin requests from localhost during dev
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
