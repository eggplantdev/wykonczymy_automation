import { defineConfig, devices } from '@playwright/test'
import { chromeLaunchOptions } from './e2e/chrome-launch'
import { STORAGE_STATE } from './e2e/global-setup'

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
  timeout: 120_000,
  expect: { timeout: 20_000 },
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    launchOptions: chromeLaunchOptions,
    trace: { mode: 'retain-on-failure', screenshots: false },
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    // The suite runs a production build, where `/sw.js` registers — and Playwright's `page.route`
    // never sees a request a service worker answers.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      // A spec that reads kosztorys columns opts into `GRID_VIEWPORT`.
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromeLaunchOptions,
        viewport: { width: 1600, height: 1000 },
        // A spec that must start logged out overrides it with an empty state.
        storageState: STORAGE_STATE,
      },
    },
  ],
  // reuseExistingServer:false is load-bearing: with it true, a running
  // `next dev` (or a stale prod server) gets silently reused and the suite tests the wrong target.
  webServer: {
    command: 'bash scripts/e2e-build.sh && pnpm start',
    env: { PORT, NEXT_DIST_DIR: E2E_DIST_DIR, DB_POSTGRES_URL: TEST_DB_URL },
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 600_000,
  },
})
