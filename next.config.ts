import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Next 16 blocks dev-only resources (HMR, dev chunks) for non-localhost origins — a phone on the
  // LAN then gets a half-hydrated page and a bogus "Missing <html> and <body>" overlay.
  allowedDevOrigins: ['192.168.*.*'],
  // E2E builds into an isolated dir (NEXT_DIST_DIR=.next-e2e) so `pnpm build` for the
  // Playwright webServer never fights the dev server's `.next` lock.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // cacheComponents: true,
  experimental: {
    serverActions: {
      // Vercel hard-caps function/action request bodies at 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE,
      // thrown by the platform before our code runs — uncatchable in-function).
      bodySizeLimit: '4.5mb',
    },
  },
  serverExternalPackages: ['payload', 'pino', 'pino-pretty', 'thread-stream'],
  images: {
    // any quality, the unspecified 75 included, is coerced to the
    // nearest allowed entry, so with one entry every image is served at 90.
    qualities: [90],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}

export default withPayload(nextConfig)
