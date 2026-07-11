# Review-gate ledger — kosztorys-snapshots (S-06) · 2026-07-10

Slice diff scope: `0e6cd47^..38a7472` (p1–p5 + epilogue) + uncommitted drawer fix.

## Findings

<!-- one checkbox per finding, most-severe first; severity tag on bug-finding-check findings only -->

### From the verification pass (Step 0.5, done this session)

- [x] 🔴 CRITICAL · fixed · `src/components/kosztorys/kosztorys-versions-drawer.tsx` · "Wersje" drawer never loaded its list (programmatic open didn't trigger the fetch); list + restore entirely dead — fixed with a fetch-on-`open` effect (setState only in guarded async callback), re-verified full list→restore flow. Owes an e2e regression (folded into 4.3).
- [x] fixed · restore of ~1000 rows took ~12.6s (row-by-row `payload.create`, ×N Payload per-doc cost, serial) — rewrote `restore-kosztorys.ts` to ONE bulk `INSERT … RETURNING id` per level on the tx-scoped Drizzle handle. Measured **~216ms for 3030 rows** (~50–60× faster). Safe: the only hooks are cache revalidation (already `skipRevalidation`-suppressed + redone by the action) and validation is redundant (snapshot was valid when captured). Guarded by the roundtrip identity + restore-action tests (both in the gate). Raw-SQL bypass risks (RETURNING-order reliance, column-drift, bypassed validation/hooks) + the owed rollback test tracked in **EX-430**.
- [x] fixed (2026-07-11) · `restoreSnapshotAction`/`saveSnapshotAction` `[PERF] 0ms` — not a timing bug: `protectedAction`'s summary line printed the last lap of `perfStart`'s lap timer (~0ms for a no-revalidate action), not total elapsed. Added `started = performance.now()` at entry in `src/lib/actions/run-action.ts` and print `now - started` on the summary line; splits keep the lap timer. Verified 302ms for a 300ms handler. No automated test (instrumentation accuracy).
- [x] skipped · dev-only React "side-effect in render function that asynchronously tries to update" warning, logged once, from the render-phase conditional setState (`setAwaitingTree`/`setRemountKey`) in `kosztorys-editor-v2.tsx:37-40` — the documented "store info from previous render" remount pattern (NOT the drawer fetch fix, which sets state only in a guarded async callback). Dev-only console hygiene, pre-dates the drawer bug, non-blocking. Deliberately not moving the remount trigger into an effect. Test disposition: no automated test.
- [x] deferred+filed (**EX-429**, non-blocking) · 5.7 deploy gate: set `CRON_SECRET` in Vercel + confirm scheduled run in cron logs post-deploy. Deploy-time follow-up, owed only when the code ships — not an archive blocker.
- [x] deferred+filed (**EX-428**, `e2e-backlog`) · versions "Wersje" drawer + snapshot-restore **E2E** owed by this browser-level slice — Playwright spec under `e2e/`, authored via `/10x-e2e`. Backend integration coverage already runs in the pre-push gate; this is only the browser leg.

### From the review fan-out (Step 1)

**Bug-finding checks**

- [x] 🟡 WARNING · deferred+filed (**EX-430**) · `src/__tests__/lib/actions/kosztorys-restore.test.ts` · no automated test for the restore **rollback** path (plan 1.6 — half-wiped tree on injected error). Manually verified this pass; now doubly relevant after the bulk-INSERT rewrite — authoring tracked as a follow-up in EX-430.
- [x] 🔵 Low-Med · deferred+filed (**EX-431**) · `src/lib/actions/kosztorys-snapshots.ts` (all four snapshot actions) · restore/list/snapshot actions gate only on `MANAGEMENT_ROLES`, no per-investment authorization (cross-investment IDOR/BOLA on a destructive wipe). **Pre-existing pattern** across all kosztorys actions — not an S-06 regression; NOT covered by S-10 (different axis: per-role field masking, not per-investment object access). Owner: not touching this yet (2026-07-11) — needs an auth-design decision.
- [x] 🔵 Low · deferred+filed (**EX-432**) · `src/lib/kosztorys/serialize-kosztorys.ts:9` · `serializeKosztorys` inherits `getKosztorysTree`'s `limit: 5000` items — a kosztorys past the cap serializes truncated, and wipe-and-reinsert restore then **permanently drops** the truncated rows (silent data-loss cliff). Safe at current 1000+ scale; needs a fail-loud guard → tech-debt.
- [x] 🔵 Low · fixed · `src/components/kosztorys/kosztorys-versions-drawer.tsx:38` · fetch-on-open had no `.catch`; a transport-level RPC rejection leaves the spinner stuck forever — added `.catch` (toast + empty list).
- [x] 🔵 Low · dismissed · `src/components/kosztorys/kosztorys-editor-v2.tsx:45` · interval `void snapshotAction` swallows a transport rejection — **intentional** documented fire-and-forget; a failed periodic snapshot must not disrupt editing.
- [x] 🔵 OBSERVATION · dismissed · `src/lib/kosztorys/restore-kosztorys.ts:101` · `snapshot.settings.*` would throw if `settings` absent — harmless at `schema_version=1` (always present); a non-additive change needs a mapper update anyway.
- [x] 🔵 OBSERVATION · dismissed · `src/lib/actions/kosztorys.ts:180,341` · forced pre-delete snapshot runs on non-tx `db`; a failed delete leaves an orphan `auto` — intended (GC reclaims), documented.
- [x] 🔵 OBSERVATION · dismissed · `src/components/kosztorys/kosztorys-versions-drawer.tsx:26` · named "…Drawer" but renders a centered `Dialog` — cosmetic, plan allowed either.
- [x] 🔵 OBSERVATION · dismissed · `src/lib/db/snapshots.ts:39` · `insertSnapshot` stamps the column version and ignores `payload.schemaVersion` — both `1`, consistent; minor redundancy.

**Structural / style checks**

- [x] applied · `src/lib/actions/kosztorys.ts:380-501` · module-cohesion: split the snapshot block into `src/lib/actions/kosztorys-snapshots.ts` (the 4 snapshot actions + `SnapshotListItemT`) and hoisted the shared `captureAutoSnapshot` helper to `src/lib/kosztorys/capture-auto-snapshot.ts` (plain module — the two delete actions in `kosztorys.ts` still call it, and a `'use server'` export would have exposed it as an unauthenticated RPC, so the "no back-refs" note was inexact). `kosztorys.ts` down to 369 lines; 5 consumers repointed. Behavior-neutral; tsc + lint clean, integration suite 21/21 green.
- [x] dismissed · `src/lib/db/snapshots.ts` · module-cohesion: types+constants+queries in one file — deliberate "single place that reads/writes the table" data-access module, cohesive. No action.
- [x] fixed · `src/lib/kosztorys/serialize-kosztorys.ts:5` · comment-noise: lead sentence restates the fn name — trim lead, keep the "pure read / order preserved" why. Apply in /simplify.
- [x] skipped · `src/lib/actions/kosztorys.ts:245` · comment-noise: narration lead on `swapItemOrderAction` — **out of S-06 scope** (reorder action, not this slice).
- [x] skipped · `src/components/kosztorys/kosztorys-editor-body.tsx:61` · tailwind: justified `h-[calc(100dvh-3.5rem)]` lacks an explanatory comment (the other two arbitrary values are commented) — cosmetic nit, not worth the churn.
- [x] dismissed · file-organization: feature-first placement + structure-scatter both clean — no misplacement, no competing homes.

## Simplify pass

- **Applied**
  - `src/lib/kosztorys/serialize-kosztorys.ts:5` · trimmed comment narration lead (kept pure-read / order-preserved why)
  - `src/components/kosztorys/kosztorys-versions-drawer.tsx:47` · added `.catch` to fetch-on-open (from code-review triage — applied pre-simplify)
- **Proposed (not applied)** — larger refactors held for the user's call; tracked only in this list (non-blocking, not mirrored as Findings checkboxes). The two that landed are marked ✅ APPLIED.
  - ✅ APPLIED · `src/lib/kosztorys/restore-kosztorys.ts` · items **and** progress restore loops were row-by-row `payload.create` → now bulk `INSERT … RETURNING id` per level (~12.6s → ~216ms). Hardening follow-ups tracked in **EX-430**.
  - `src/lib/actions/kosztorys.ts:447-461` + `transfers.ts:83-88` · extract a `withPayloadTransaction(payload, {context}, fn)` helper — both hand-roll begin/commit/rollback + cast req. Cross-file refactor.
  - `src/lib/actions/kosztorys.ts:380-501` · split the snapshot actions into `kosztorys-snapshots.ts` (module-cohesion). Cross-file.
  - `src/components/kosztorys/kosztorys-editor-v2.tsx:29-52` · deeper form for the drawer: conditionally mount `{versionsOpen && <Drawer/>}` → fetch-on-mount, drops the `[open]` guard + `active` flag + reset. Design change to parent+contract.
  - `src/lib/actions/kosztorys.ts:164-180,329-341` · two sequential SELECTs (guard + investment_id) on section/stage delete → fold `investment_id` into the guard query.
  - `src/lib/actions/kosztorys.ts:176-180,337-341` · dedup the two identical pre-delete snapshot blocks (dynamic table id, only 2 sites — low value).
- **Dismissed**
  - `src/components/kosztorys/kosztorys-editor-v2.tsx:29-52` remount machine — necessary complexity, honors the "no remount on routine refresh" lesson; correct depth.
  - `restore-kosztorys.ts:25-26` two sequential DELETEs — single tx connection, not parallelizable.

### Additional finding surfaced by /simplify (altitude)

- [x] **fixed (2026-07-11)** — latent edge · `src/components/kosztorys/kosztorys-editor-v2.tsx` · if a restored snapshot was **referentially identical** to the live `tree` after `router.refresh()`, `treeChanged` stayed false and `awaitingTree` stayed stuck `true` — the next ordinary edit's refresh then remounted the grid mid-edit (drops sort/filter/optimistic state). **Fix:** clear the `awaitingTree` latch on drawer close (`handleVersionsOpenChange`). An identical tree means there is nothing to remount for, so clearing loses no real restore, and the stuck-flag window closes when the user leaves the drawer. (Chose this over snapshot-id correlation: the id route pays real plumbing to handle a case with no observable difference.) Test disposition: unit/integration on the remount gate if pursued — deferred with the slice's other owed tests.

## Tests & suite

Test authoring deferred to the user (their call — "I'll go back to these issues"). The one owed test is the restore **rollback** regression (impl-review 🟡, still open below). Fast legs run 2026-07-10:

- **typecheck** (`tsc --noEmit`) — ✅ pass
- **lint** (`pnpm lint`) — ⚠️ 15 pre-existing errors, all in `scripts/inspect-sheet.mjs` (`no-undef`, untouched by this slice); every S-06 file + both this-pass edits lint clean.
- **unit/integration** — S-06 suite ✅ 7/7 pass **against the test DB** (`DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST`): restore revert + forced-auto, serialize/restore roundtrip identity, manual-label store, 50-cap prune. NOTE: these are `describe.skipIf(!DB)` integration tests — a plain `pnpm test` with no DB **skips all 7** (confirms the coverage only fires when a DB is wired).
- **e2e / build** — not run (fast-legs only, user choice).
- Confirms impl-review's gap: a restore-**revert** test exists; a restore-**rollback-on-error** test does not.

### Finding surfaced by the suite run

- [x] **fixed — The S-06 restore/snapshot integration suite ran in no automatic gate** — no CI exists; the only gate is `.husky/pre-push`, which ran `pnpm vitest run` **bare** (no DB env → all `describe.skipIf(!ENV_READY)` DB tests skipped) and `pnpm test:parity` (dev DB only). So the restore safety suite silently skipped on every push. **Fix (2026-07-11):** added `scripts/test-integration.sh` + `pnpm test:integration`, wired into `.husky/pre-push`. It ups the isolated **5435** `db-test`, keeps its schema current (re-imports the prod dump **only** when the migration fingerprint changes or the `kosztorys_snapshots` sentinel table is absent — the specs self-provision fixtures, so fresh prod _content_ buys nothing), auto-discovers the DB-gated files by their shared `skipIf(!ENV_READY)` marker (minus parity, which keeps its own dev-DB leg), and runs them **serially** (`--no-file-parallelism`). Verified: 8 files / 21 tests green across 4 runs, ~24–30 s. **Test disposition:** infra/plumbing — no product test; this _is_ the gate that runs the tests.
- [x] **fixed — sibling-slice DB tests had rotted (caught by the new gate)** — running the previously-ungated DB suite against a clean prod-dump test DB surfaced 3 failures in `kosztorys-stages`, `kosztorys-delete-guard`, and `leads/store-lead` — **not product bugs**: (a) both kosztorys specs hardcoded `requireAuth → user.id 1`, but S-06's pre-delete snapshot FKs `taken_by → users.id` and a fresh dump has no user 1 (ids start at 15) → replaced with a real-user lookup (the S-06 pattern); (b) both borrowed `find(investments, limit:1)` unsorted, racing the parallel S-06 specs that create+delete high-id investments → pinned to `sort:'id'` (oldest, prod-dump, never deleted); (c) `beforeAll` `getPayload` cold-init exceeded the 10 s hook budget under load → bumped to 30 s. These only ever ran by hand against the dev DB, so the rot was invisible — exactly what the gate now catches. **Test disposition:** test-only fixes; no product change.
