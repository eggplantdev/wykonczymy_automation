import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  // E2E builds into an isolated dir (NEXT_DIST_DIR=.next-e2e) so `pnpm build` for the
  // Playwright webServer never fights the dev server's `.next` lock. Unset in normal runs.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // cacheComponents: true,
  experimental: {
    serverActions: {
      // Vercel hard-caps function/action request bodies at 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE,
      // thrown by the platform before our code runs — uncatchable in-function). This must not exceed
      // it: a higher value is a lie on prod and only "works" locally where there is no platform cap.
      bodySizeLimit: '4.5mb',
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
