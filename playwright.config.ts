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
  // One worker: fullyParallel:false only serializes tests WITHIN a file — Playwright still
  // parallelizes across files, which pits specs against each other on one cold server and one
  // shared local DB (mutation specs touch the same registers). Serialize the whole suite.
  workers: 1,
  // The first authenticated test pays the cold prod server's first-hit render (~28s observed);
  // 60s per test keeps that off the flake line. webServer boot has its own budget below.
  timeout: 60_000,
  // Seeds the OWNER user and captures an authenticated storageState (e2e/.auth/user.json)
  // once per run. No global `storageState` here — that would break the unauthenticated smoke
  // and login specs; authenticated specs opt in via test.use({ storageState }).
  globalSetup: './e2e/global-setup.ts',
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
    // Full `pnpm build` (generate:importmap + generate:types + next build) then `pnpm start`.
    // A cold build (cold TS typecheck + Payload codegen) overruns 300s; 600s gives headroom.
    timeout: 600_000,
  },
})
