import base from './playwright.config'

// Fast-iteration config: run the real specs against an ALREADY-RUNNING server on 3100 instead of
// paying the ~6-min `pnpm build && pnpm start` that the default config forces per run. Use it as
// the inner debug loop when writing/fixing E2E specs; keep the default `pnpm test:e2e` as the
// authoritative pre-commit gate (it builds fresh and catches cold-boot flakiness this can't).
//
//   1. build once:   NEXT_DIST_DIR=.next-e2e pnpm build
//   2. start it:     pnpm test:e2e:warm:server
//   3. iterate:      pnpm test:e2e:warm [e2e/some.spec.ts]   # ~20s, not ~6min
//
// Step 2 is a script rather than a pasted command line on purpose, and it is the one line here that
// is not convenience. The specs write through whatever DB that server holds, and the seeds cannot
// stop them: globalSetup pins ITS OWN connection to `DB_POSTGRES_URL_TEST`, so a server started
// against the 5433 dev DB produces a run that seeds the test DB and then mutates — and deletes —
// real local data, with every assertion still green. The script also does the fetch-cache wipe the
// default config's webServer does for you: `unstable_cache` persists across rebuilds AND across a
// `db:import:test`, so a kept cache answers with figures the restored DB can no longer produce.
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
