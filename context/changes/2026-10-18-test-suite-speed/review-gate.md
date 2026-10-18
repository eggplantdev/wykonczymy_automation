# Review-gate ledger — test-speed optimizations · 2026-10-18

Scope: `a30df479f..97c725dff` on `staging` (first-parent, 14 commits) plus `bd3ed4869` (test DB template, merged in via `a30df479f`).
Covers test-suite-speed, unit-suite-speed, prepush-overlap and e2e-run-speed. Not covered: `86e75012c..a30df479f`
(e2e-backlog specs, mobile fixes) — outside this optimization work.

Checks: 10x-impl-review, code-review, comment-noise-audit (flag-only), feature-first-structure, module-cohesion-audit,
structure-scatter-audit (diff-scoped). Dropped: tailwind-v4-audit (no `className` in scope). Step 0.5 verify pass skipped:
dev tooling only, no app surface.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `scripts/pre-push-tests.sh:8` · trap killed only the 3 leg PIDs; a killed hook left the integration vitest / `docker exec psql` writing to 5435 after the lock released — `set -m` gives each leg its own process group, the trap kills the groups, `INT`/`TERM` exit through it
      test: no automated test · — shell signal path; verified by a toy script (orphan child gone after `kill -TERM`)
- [x] 🟡 WARNING · fixed · impl-review · `.husky/pre-push:23` · under husky's `sh -e`, `grep '\.ts$'` matching nothing aborted every push to `main` without an added migration — `|| true` (pre-dates this range; one-token fix)
      test: no automated test · — verified `sh -e` survives an empty match
- [x] 🟡 WARNING · fixed · code-review + impl-review + simplify · `scripts/test-db-template.sh:10` · fingerprint missed what the seeds write through — the seeds write only `kosztorys-items` / `-sections` / `-stages` / `stage-progress`, whose hooks only revalidate; those 4 files joined the fingerprint (13 commits this month vs 88 for all of `src/collections`). The interim AGENTS.md "run `db:template:test` after a hook change" rule is gone
      test: no automated test · — fingerprint input list; the next reset rebuilds once
- [x] 🔵 OBSERVATION · fixed · impl-review · `scripts/test-db-template.sh:54` · a clone whose CREATE failed left no `wykonczymy-test`, and the rebuild's `db:import:test` connects to it — the rebuild creates it when missing
      test: no automated test · — needs a failing CREATE; one-line guard
- [x] 🔵 OBSERVATION · fixed · impl-review · `scripts/test-db-template.sh:58` · `docker compose up` failure exited with no message — stderr kept
      test: no automated test · — output-only
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/cache/revalidate.test.ts:6`, `google/auth.test.ts:9` · `vi.unmock` / `vi.resetModules` ran in `node-shared` — `isolatesModules` matches both; `vitest list`: node 62→64, node-shared 357→355; both specs green
      test: no automated test · — the partition is the guard
- [x] 🔵 OBSERVATION · fixed · code-review · `scripts/e2e-build.sh:13` · a non-ASCII path came out quoted, failed `[ -f ]` and dropped out of the hash — `core.quotePath=false`
      test: no automated test · — no such path today
- [x] 🔵 OBSERVATION · dismissed · code-review · `scripts/e2e-build.sh:16` · `.env.production*` unhashed — neither file exists; shell-exported env is outside any file fingerprint
- [x] 🔵 OBSERVATION · dismissed · impl-review · `scripts/e2e-build.sh:13` · `playwright.config.ts` `webServer.env` unhashed — it sets only `PORT` / `NEXT_DIST_DIR` / the DB URL, none read at build time; hashing it rebuilds on every timeout tweak
- [x] 🔵 OBSERVATION · dropped · code-review · `fetch-landing-asset`, `notify`, `fetch-lead`, `google/auth` specs · top-level `process.env` writes persist across `node-shared` files — no spec reads those vars as unset
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `setup/dom.ts:48`, `stubs/next-navigation.ts`, `setup/db.ts`, `investor-actions.test.tsx:17` · `domToast`, `router.*`, `getCurrentUserJwt` implementations and the fake clipboard survive across shared files — no shared spec steers them persistently; a blanket `mockReset` would wipe the stubs' default implementations
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/__tests__/setup/seams.ts:17` · registry key is the export names, not the module — no collision today; the `vi.mock` factory never sees the module path, so keying on it means a signature change at 13 call sites
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/__tests__/setup/db.ts` · DB seams reset to the real translate / extract / Sheets calls — same as before the seams (an unsteered per-file spec also hit them); every migrated spec steers its seams
- [x] 🔵 OBSERVATION · dismissed · impl-review · F9 / F10 · extras beyond the plans and mechanism differences — behaviour-equivalent, documented in `src/__tests__/AGENTS.md`
- [x] 🔵 OBSERVATION · fixed · impl-review · `AGENTS.md:290` · E2E bullet said reset with `db:import:test` (unseeded) — now `db:reset:test`
- [x] 🔵 OBSERVATION · fixed · impl-review · `2026-10-18-prepush-overlap/plan.md` Progress 2.1–2.3 · missing SHA — `— 29dfc3b16`
- [x] 🔵 OBSERVATION · dropped · impl-review · `2026-10-18-unit-suite-speed/plan.md` Phase 5 · no "superseded by prepush-overlap" note — prepush-overlap's plan records it; the plan archives as is
- [x] fixed · comment-noise · `src/__tests__/lib/actions/accept-worker-report.db.test.ts:322` · stale claim: `settleReport` is not the last write (`bumpInvestmentRevision` follows) — premise dropped
- [x] fixed · comment-noise · `.husky/pre-push:57` · lock comment duplicated `pre-push-tests.sh:2`; its DB-leg sentence moved verbatim above the leg it guards
- [x] fixed · comment-noise · `scripts/test-db-template.sh:37` · the golden-master seed warning lost in bd3ed4869 restored above the seeds
- [x] fixed · comment-noise · `scripts/e2e-build.sh:2`, `scripts/test-db-template.sh:2`, `setup/db.ts:6`, `setup/dom.ts:57`, `setup/dom.ts:78`, `vitest.config.ts:40`, `:118`, `:122` · 8 headers / restatements / policy duplicates deleted
- [x] fixed · comment-noise · `next.config.ts:12`, `catalogue-to-kosztorys.db.test.ts:235` · trimmed (timing, restated aside)
- [x] dismissed · feature-first-structure, module-cohesion-audit, structure-scatter-audit · no findings
- [x] fixed · simplify · `scripts/pre-push-tests.sh:21` · parity ran after every leg finished — chained behind integration in the same leg; the unit leg (57 s) outlasts integration + parity (38 + 6 s)
- [x] fixed · simplify · `scripts/test-db-template.sh:63` · `db:reset:test` ran the script twice (two `.env` sources, two `docker compose up`) — `reset` subcommand; the extra `docker compose up` in `test-integration.sh` and `test:e2e` dropped
- [x] fixed · simplify · `vitest.config.ts:111` · three copy-pasted isolated/shared project pairs — `pair()` helper
- [x] fixed · simplify · `package.json`, `pre-push-tests.sh`, `test-integration.sh` · 7 sites spelled out both project names — `--project 'node*' --project 'dom*'` / `'db*'`; `vitest list --filesOnly` identical to the explicit form (node 64, node-shared 355, dom 22, dom-shared 140, db-shared 160)
- [x] fixed · simplify · `vitest.config.ts:79` · project-level `passWithNoTests` is a no-op (vitest reads it from the root config only) — removed with its comment
- [x] skipped · simplify · `scripts/test-db-template.sh:35` · clone into a temp name + rename instead of the missing-DB guard — rewrites the clone's failure path for a case never seen; the guard is one line
- [x] skipped · simplify · `setup/dom.ts` `ingestFiles` / `scanReceipt` stub default — reviewers disagreed on the right default, and changing it changes what unsteered specs see
- [x] skipped · simplify · two lost-write autosave specs · shared helper — the helper's parameters would equal its body
- [x] dropped · simplify · `serverActionStubs` registry folded into `seams.ts` — couples the config plugin to a setup file; the two registries have different lifetimes
- [x] dropped · simplify · `afterAll` cleanup shared across setup files — 3 lines, each setup owns its own
- [x] dismissed · simplify · `scripts/e2e-build.sh:19` · fetch-cache comment called stale — `cached()` keys on the deployment and a reused build keeps its id, so the entries do outlive a reset
- [x] dismissed · simplify · `setup/db.ts` external seams default to a throwing stub; `setup/node.ts` env snapshot / clipboard restore — same mechanisms as the dismissed real-call seams and dropped env / clipboard leaks above
- [x] dismissed · simplify · e2e `generate:types` step — `pnpm build` already runs it

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 6 applied, 3 skipped, 2 dropped, 3 dismissed; each finding folded into ## Findings (tagged simplify). primitive-reuse-scan dropped: no UI components in scope.

## Tests & suite

- `bash -n` on every `scripts/*.sh` — clean.
- `tsc --noEmit` — clean.
- `vitest list --filesOnly` with the wildcards — the same files as the explicit project names.
- Full pre-push suite (`with-test-lock.sh bash scripts/pre-push-tests.sh`, no `db:dump`), rc 0, 152 s:
  - The template rebuilt once on the new fingerprint (~30 s, running alongside the unit leg).
  - unit 580 files passed (1 skipped).
  - typecheck clean.
  - integration 158/158.
  - parity 2/2, on a reused template.
- Manual checks: the prepush-overlap box was reworded for the new leg layout. The prepush-overlap (2) and e2e-run-speed (2) boxes are open → in review, not archived.
