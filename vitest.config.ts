import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
    css: false,
  },
  css: {
    postcss: { plugins: [] },
  },
  resolve: {
    alias: {
      // Most specific first — vite matches alias keys in order.
      // env.server eagerly parses the full server schema at import; swap it for a
      // process.env passthrough so unit tests needn't supply every server var.
      '@/lib/env.server': path.resolve(__dirname, './src/__tests__/stubs/env-server.ts'),
      '@/lib/env': path.resolve(__dirname, './src/__tests__/stubs/env.ts'),
      '@': path.resolve(__dirname, './src'),
      '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
      // Node test env lacks the `react-server` condition, so the real `server-only`
      // throws on import. Map it to a no-op stub.
      'server-only': path.resolve(__dirname, './src/__tests__/stubs/server-only.ts'),
    },
  },
})
