---
date: 2026-10-18T18:28:06+0200
researcher: Claude
git_commit: 8fb828e54
branch: staging
repository: wykonczymy
topic: 'Where does the remaining test wall-clock time go, and what cuts it further?'
tags: [research, testing, vitest, playwright, pre-push, test-db]
status: in_progress
last_updated: 2026-10-18
last_updated_by: Claude
---

# Research: where the remaining test time goes

## Research Question

After EX-1093 cut `test:integration` from 250 s to 70 s, where does the remaining wall-clock go in
`pnpm test` (node + dom), `test:integration` (db + db-shared), the pre-push legs and `test:e2e`,
and which levers cut it further, ranked by saving vs risk?

## Summary

- **Pre-push without the unit leg: ~140–185 s.** typecheck 8–21 s, integration 70 s, parity 32 s,
  `db:dump` ~30–60 s (estimated — not run, it reads prod).
- **The 22 isolated `db` specs cost 46 s for 228 tests.** ~1.2 s of module import per file
  (26.9 s total) against 4.4 s of import for all 135 `db-shared` files. Payload boot itself is only
  0.2–0.45 s. All 22 can move to `db-shared` (§1).
- **`test:parity` spends 27.3 s of its 31.8 s re-importing the test DB.** A Postgres
  `CREATE DATABASE … TEMPLATE` clone measured 1.4 s (§2).
- **A full E2E run is 12–20 min, not ~1 h.** The hour was six cold re-runs in a fix loop, each
  rebuilding the app (~2.2–2.8 min fixed cost per run) (§4).
- **Unit (node + dom): pending** — the measuring agent hasn't reported yet (§5).
- **Side finding:** the hourly Neon backup GitHub Action has failed every run since
  2026-10-16 17:48 UTC at „Compare against previous backup" — the pre-push `db:dump` is the only
  fresh prod backup until it's fixed.

## Detailed Findings

### 1. Isolated `db` project — 22 files, 45.95 s (import 26.89 s, tests 16.83 s)

Specs land in `db` when their source matches the mock regex at `vitest.config.ts:50`
(`vi.mock` / `vi.doMock` / `vi.spyOn`). Each one pays its own module graph. By what keeps them
there:

- **A — `vi.spyOn` on the shared `payload` inside a test (4 files):** account-credentials,
  transfers, worker-expense-drafts (db), worker-report-scan. Move by dropping `spyOn` from the
  regex and adding `afterAll(() => vi.restoreAllMocks())` to `setup/db.ts`: `restoreMocks` restores
  only _before each test_, so a spy left by one file's last test would still be live during the next
  file's `beforeAll`. ~6 s, low risk.
- **B — pass-through wrappers that fail on a flag (7 files):** accept-worker-report
  (`settleReport`), kosztorys-presets (`serializeTemplate`), kosztorys-add-item
  (`applyCatalogueWrite`), catalogue-to-kosztorys (`placeCatalogueItems`),
  replace-tree-lost-write + kosztorys-restore-lost-write (`serializeKosztorys`),
  create-investment-preset (`seedInvestmentFromPreset`). Register once in `setup/db.ts` around a
  resettable state object (like `authState`); disarmed they behave as the real module. ~10 s.
- **C — external services (11 files):** translation (`translateTexts`, `translateToPolish`),
  Google sheet modules, `ai/openrouter` + `fetchMediaBytes`, `reclaimUnreferencedMedia`,
  settle-payouts (`after` inline + `sheets-sync` + `notify-pending-payouts`). Stub globally in
  `setup/db.ts` with resettable `vi.fn`s. Safe because only `worker-report` and
  `translate-at-creation` call `flushAfter()`, both already in this group. ~16 s.

Comments at `vitest.config.ts:66` ("~9-10s cold boot") and `:94` no longer match the measurements.

### 2. `test:parity` — 31.8 s

| Step                                                               | Time                 |
| ------------------------------------------------------------------ | -------------------- |
| drop schema                                                        | 0.34 s               |
| `psql` import of the 243 MB dump (211 MB is `kosztorys_snapshots`) | 7.57 s               |
| reset sequences                                                    | 0.14 s               |
| `db:migrate:test`                                                  | 4.53 s               |
| seed:kosztorys / seed:deposits / seed:materials-net                | 8.72 / 2.99 / 3.04 s |
| the two parity specs                                               | 4.45 s               |

The re-import exists because E2E writes to the investments the golden master covers. A template
clone (measured: 1.23 s create, 1.41 s clone) turns 27.3 s into ~2–3 s. Catch: pre-push rewrites
the dump on every push (`db:dump` runs after parity), so a template keyed on the dump's content
always misses — rebuild it in the background after the dump or on a timer. When migrations change,
`scripts/test-integration.sh:18` also runs a full reset, so those pushes pay 27 s twice.

### 3. `db-shared` — 135 files, 31.92 s (import 4.43 s, tests 26.90 s)

Flat: ~190 ms per file, no sleeps, no hotspot. Slowest file expense-duplicate-groups 1.68 s (one
1.0 s test scanning every prod transaction). Trimming here is worth 1–2 s at most.
`db/notifications.db.test.ts` "counts leads created after the cursor" failed once (expected 0, got 2)
on a test DB left by an E2E run — likely leftover-data coupling, not investigated.

### 4. E2E — 33 files, 67 tests, 12–20 min per full cold run

- `playwright.config.ts`: 1 worker (`:22`), `fullyParallel: false`, no local retries, web server
  `rm -rf .next-e2e/cache/fetch-cache && pnpm build && pnpm start` on every run (`:59`,
  `reuseExistingServer: false`).
- `next build` 131.4 s: Turbopack 90.9 s, TypeScript 36.0 s. `payload generate` steps unmeasured.
- Fixed cost per run ~2.2–2.8 min (build + start + seed + login). The test DB is never reset;
  seeds pile up (191 of 392 investments came from today's runs).
- Suspected ~20 s floor on every test that picks „Inwestycja": `e2e/drivers/combo.ts:5`
  `ATTEMPT_TIMEOUT_MS = 15 s`, consistent with one missed attempt per pick. Hypothesis — confirm
  with a trace.
- Slowest file kosztorys-structure 104.7 s (5 tests, 2 failed in the sample run).

### 5. Unit — node (419 files) + dom (162 files)

Pending: the measuring agent is still running. To be appended as a follow-up.

### 6. typecheck

`incremental: true`, `tsconfig.tsbuildinfo`. Cold 21.3 s, after edits 20.45 s, no-change floor
8.05 s (6,825 files, 217k lines; `googleapis` alone 913 files).

## Ranked levers

| #   | Lever                                                                                                                                                               | Saves                                      | Risk                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | Move the 22 `db` specs to `db-shared` (A → B → C)                                                                                                                   | ~30–34 s per integration run               | A low; B/C medium                                                         |
| 2   | Test DB from a template clone instead of re-import                                                                                                                  | ~25 s per push (~50 s on migration pushes) | low–medium: template invalidation                                         |
| 3   | E2E: warm server + `--last-failed` while iterating (`test:e2e:warm*`, `lessons.md:320-322`)                                                                         | ~25–35 min per fix session                 | low                                                                       |
| 4   | E2E: skip rebuild when a src/config/lockfile hash matches; `typescript.ignoreBuildErrors` for `.next-e2e` only (36 s); Turbopack build cache (experimental in 16.1) | ~2.2–2.5 min per run                       | low–medium                                                                |
| 5   | `db:dump` off the critical path (background / skip when fresh)                                                                                                      | ~30–60 s (estimated)                       | it's the only working prod backup right now — fix the backup Action first |
| 6   | Run typecheck alongside `test:integration` (single worker)                                                                                                          | ~8–21 s                                    | low–medium                                                                |
| 7   | E2E: parallel group (2–3 workers) for specs on their own seeded records, serial group for shared-state specs                                                        | ~5 min per full run                        | medium: CPU contention, shared DB                                         |
| 8   | E2E: shorten the combo confirmation wait / type-to-filter                                                                                                           | ~2–2.5 min per run (if confirmed)          | low                                                                       |
| 9   | E2E: reset the test DB from the template before each run                                                                                                            | <1 min; mainly repeatability               | low                                                                       |

Not worth it: trimming `db-shared` tests; lazy-loading `googleapis` (moot after lever 1);
per-worker E2E databases (each needs its own server, shared `.next-e2e` data cache); sharding
(no CI runs e2e).

## Concurrency (can the suites run at once?)

Today integration, parity and E2E all use `wykonczymy-test` on 5435: parity wipes it, the golden
master needs pristine data, and the E2E server's cache goes stale under foreign writes.
`payload generate:types` in the E2E build also races `tsc`. The enabling move is lever 2's
template: one clone per suite (and per worker where needed), after which the machine-wide lock is
the only serializer left.

## Code References

- `vitest.config.ts:50` — mock regex that sorts DB specs into `db` / `db-shared`
- `src/__tests__/setup/db.ts` — DB-only setup (session mock); home for levers 1A–C
- `scripts/test-integration.sh:13-19` — migration-change reset
- `package.json:22` — `db:reset:test`
- `.husky/pre-push:68,84-90,107` — integration leg, `db:dump`, detached deploy watcher
- `playwright.config.ts:22,59,62` — workers, web-server rebuild, no reuse
- `e2e/drivers/combo.ts:5,33-37` — 15 s confirmation attempt

## Historical Context

- EX-1093 (commit `69f51109c`): session mock moved to `setup/db.ts`; db/db-shared 86/73 → 22/137;
  integration 250 s → 70 s, import 135.5 s → 30.8 s.
- `context/archive/2026-09-15-e2e-backlog-audit/audit.md:28` — the stale "~1h" E2E figure (Rosetta era).

## Open Questions

- Unit suite breakdown (§5).
- Why the backup Action fails at „Compare against previous backup".
- Whether the combo miss is real (needs a trace on a warm server).
