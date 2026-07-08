import { defineConfig, devices } from '@playwright/test'

// E2E runs on its OWN port (3100), never the dev server's 3000. Combined with
// reuseExistingServer:false below, this guarantees `pnpm test:e2e` builds and tests a
// fresh production server instead of silently reusing a running `next dev` (whose
// on-demand compilation + Fast Refresh cause hydration races that flake the suite).
// Overridable (PORT env) for isolated worktrees.
const PORT = process.env.PORT ?? '3100'
const BASE_URL = `http://127.0.0.1:${PORT}`

// Isolated build dir so the E2E `next build` doesn't fight the dev server's `.next` lock —
// next.config.ts reads NEXT_DIST_DIR. Lets the suite build while `next dev` keeps running.
const E2E_DIST_DIR = '.next-e2e'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    channel: 'chrome', // system Google Chrome, no bundled browser download
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  // Always build and test a FRESH production server — never `next dev`, and never reuse an
  // existing one. reuseExistingServer:false is load-bearing: with it true, a running
  // `next dev` (or a stale prod server) gets silently reused and the suite tests the wrong
  // target. PORT + NEXT_DIST_DIR isolate this server so it coexists with the dev server.
  webServer: {
    command: 'pnpm build && pnpm start',
    env: { PORT, NEXT_DIST_DIR: E2E_DIST_DIR },
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
