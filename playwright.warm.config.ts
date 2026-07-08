import base from './playwright.config'

// Fast-iteration config: run the real specs against an ALREADY-RUNNING server on 3100 instead of
// paying the ~6-min `pnpm build && pnpm start` that the default config forces per run. Use it as
// the inner debug loop when writing/fixing E2E specs; keep the default `pnpm test:e2e` as the
// authoritative pre-commit gate (it builds fresh and catches cold-boot flakiness this can't).
//
//   1. build once:   NEXT_DIST_DIR=.next-e2e pnpm build
//   2. start it on the 5435 test DB (NOT the dev DB on 5433):
//        source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" \
//          NEXT_DIST_DIR=.next-e2e PORT=3100 ./node_modules/.bin/next start
//   3. iterate:      pnpm test:e2e:warm [e2e/some.spec.ts]   # ~20s, not ~6min
//
// globalSetup still re-seeds and re-captures storageState against the warm server, so auth works.
export default {
  ...base,
  webServer: {
    command: 'true', // no-op: the server is already up; reuse it
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 5_000,
  },
}
