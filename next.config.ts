import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  // cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Cache rendered pages in the client Router Cache for 5 min.
  // Dynamic pages (searchParams/headers) skip this cache by default,
  // causing a full server round-trip + loader on every navigation.
  // Server Actions automatically clear the cache, so own mutations
  // always show fresh data. Staleness only affects other users' changes.
  // experimental: {
  // staleTimes: {
  // dynamic: 300,
  // },
  // },
  serverExternalPackages: ['payload', 'pino', 'pino-pretty', 'thread-stream'],
  images: {
    qualities: [50, 80],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.wykonczymy.com.pl',
      },
    ],
  },
}

export default withPayload(nextConfig)
