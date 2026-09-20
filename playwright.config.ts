import { defineConfig, devices } from '@playwright/test'
import { chromeLaunchOptions } from './e2e/chrome-launch'

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

// The suite runs against the isolated db-test container (5435, docker-compose `db-test`), never
// the dev DB on 5433 — so specs can create/cancel real rows without drifting your working data.
// Required, not optional: a missing value must fail loudly rather than silently hit 5433.
const TEST_DB_URL = process.env.DB_POSTGRES_URL_TEST
if (!TEST_DB_URL) {
  throw new Error(
    'DB_POSTGRES_URL_TEST is required for E2E — it points the suite at the 5435 test DB, not the dev DB on 5433. Add it to .env (see docker-compose `db-test`).',
  )
}

export default defineConfig({
  testDir: './e2e',
  // One worker: fullyParallel:false only serializes tests WITHIN a file — Playwright still
  // parallelizes across files, which pits specs against each other on one cold server and one
  // shared local DB (mutation specs touch the same registers). Serialize the whole suite.
  workers: 1,
  // Cold prod-server first hits are slow: the auth spec pays ~34s for the first authenticated
  // render, and each mutation spec then hits a heavy financial route (/kasa/[id]) cold for the
  // first time on top of a multi-combo form flow. 60s left the mutation specs on the flake line;
  // 120s absorbed the cold penalty but nothing beyond it: headless Chrome composites in software
  // here, so a spec that opens two extra contexts over a wide grid lands at 2.1 min on a machine
  // running the rest of the suite — and a ceiling costs nothing until a test actually reaches it.
  timeout: 300_000,
  // The mutation specs assert on state that appears only after a server-action → revalidate →
  // router.refresh round-trip (the new row, the reverted saldo). On a cold server that RSC
  // refresh runs well past Playwright's 5s `expect` default, so the row-appears/saldo asserts
  // flake. Warm they resolve in <1s, so a wider bound costs nothing but the price of a real failure.
  expect: { timeout: 45_000 },
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
    // system Google Chrome, no bundled browser download — see e2e/chrome-launch.ts
    launchOptions: chromeLaunchOptions,
    // `on-first-retry` records NOTHING locally, where retries are 0 — every local failure this
    // session had to be re-run to be seen at all. Kept off the passing path, so the cost is paid
    // only by a test that actually failed.
    trace: 'retain-on-failure',
    // Playwright leaves actions and navigations UNBOUNDED by default, and an unbounded wait
    // (`waitForEvent('download')` on a button that never downloads) doesn't fail — it eats the whole
    // 300 s test budget and then reports a bare „Test timeout exceeded" naming nothing. A per-action
    // ceiling turns that into a failure that says which action, which is the difference between a
    // diagnosis and another five-minute run. Matched to the `expect` ceiling; navigation gets more
    // because a cold prod route here genuinely can take a minute.
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: 'chromium',
      // Wider than any real monitor on purpose. react-datasheet-grid virtualises COLUMNS, so a
      // kosztorys column past the right edge is not in the DOM at all — a spec would read „no such
      // column" and, worse, a locator taken by index before a scroll points at a different column
      // after it. A viewport that fits the whole grid keeps every column rendered at once.
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromeLaunchOptions,
        viewport: { width: 3000, height: 1400 },
      },
    },
  ],
  // Always build and test a FRESH production server — never `next dev`, and never reuse an
  // existing one. reuseExistingServer:false is load-bearing: with it true, a running
  // `next dev` (or a stale prod server) gets silently reused and the suite tests the wrong
  // target. PORT + NEXT_DIST_DIR isolate this server so it coexists with the dev server.
  webServer: {
    // The data cache is wiped first. `unstable_cache` persists to `<dist>/cache/fetch-cache`, which
    // survives both a rebuild and a `pnpm db:import:test` — so a run started after the test DB was
    // restored serves figures computed from rows that no longer exist. That is invisible until a spec
    // reads a „before" figure, writes, and reads again: the write invalidates the tag, the second read
    // is honest, and the delta is nonsense (19 000,48 → 11 070,94 on a +137,41 booking, 2026-09-18).
    // The suite's invariant is a cold data cache against a known DB, so the wipe belongs here rather
    // than in whoever remembers.
    command: `rm -rf ${E2E_DIST_DIR}/cache/fetch-cache && pnpm build && pnpm start`,
    env: { PORT, NEXT_DIST_DIR: E2E_DIST_DIR, DB_POSTGRES_URL: TEST_DB_URL },
    url: BASE_URL,
    reuseExistingServer: false,
    // Full `pnpm build` (generate:importmap + generate:types + next build) then `pnpm start`.
    // A cold build (cold TS typecheck + Payload codegen) overruns 300s; 600s gives headroom.
    timeout: 600_000,
  },
})
