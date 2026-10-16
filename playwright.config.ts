import { defineConfig, devices } from '@playwright/test'
import { chromeLaunchOptions } from './e2e/chrome-launch'

const PORT = process.env.PORT ?? '3100'
const BASE_URL = `http://127.0.0.1:${PORT}`

const E2E_DIST_DIR = '.next-e2e'

const TEST_DB_URL = process.env.DB_POSTGRES_URL_TEST
if (!TEST_DB_URL) {
  throw new Error(
    'DB_POSTGRES_URL_TEST is required for E2E — it points the suite at the 5435 test DB, not the dev DB on 5433. Add it to .env (see docker-compose `db-test`).',
  )
}

export default defineConfig({
  testDir: './e2e',
  // fullyParallel:false only serializes tests WITHIN a file — Playwright still
  // parallelizes across files, which pits specs against each other on one cold server and one
  // shared local DB.
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 45_000 },
  // No global `storageState` here — that would break the unauthenticated smoke
  // and login specs.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    launchOptions: chromeLaunchOptions,
    trace: 'retain-on-failure',
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
    // The suite runs a production build, where `/sw.js` registers — and Playwright's `page.route`
    // never sees a request a service worker answers.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      // react-datasheet-grid virtualises COLUMNS, so a
      // kosztorys column past the right edge is not in the DOM at all.
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromeLaunchOptions,
        viewport: { width: 3000, height: 1400 },
      },
    },
  ],
  // reuseExistingServer:false is load-bearing: with it true, a running
  // `next dev` (or a stale prod server) gets silently reused and the suite tests the wrong target.
  webServer: {
    // `unstable_cache` persists to `<dist>/cache/fetch-cache`, which
    // survives both a rebuild and a `pnpm db:import:test` — so a run started after the test DB was
    // restored serves figures computed from rows that no longer exist.
    command: `rm -rf ${E2E_DIST_DIR}/cache/fetch-cache && pnpm build && pnpm start`,
    env: { PORT, NEXT_DIST_DIR: E2E_DIST_DIR, DB_POSTGRES_URL: TEST_DB_URL },
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 600_000,
  },
})
