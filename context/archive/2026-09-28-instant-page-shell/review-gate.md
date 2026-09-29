# Review-gate ledger — instant-page-shell (EX-877) · 2026-09-29

Scope: staged diff in worktree `instant-page-shell` vs base `d4301ba8`. Checks: code-review,
comment-noise-audit (flag-only), tailwind-v4-audit, feature-first-structure + module-cohesion-audit +
structure-scatter-audit. `/10x-impl-review` dropped — the change has no `plan.md` (spike → change,
decisions in `change.md`). Verification pass: covered by the owner's hands-on check of both builds
(2026-09-28, loader position fixed from it) and the two measured runs in `spike/results.md`.

## Findings

- [x] 🔵 OBSERVATION · dropped · code-review · `src/app/(frontend)/(dashboard)/loading.tsx` · an EMPLOYEE sent to a page that redirects them (`/` → `/kasa/[id]`) sees that page's title for the redirect's duration — cosmetic, the redirect chain predates this change and the 🚧 was shown there before
      test: no automated test — cosmetic transient, no data or access at stake
- [x] 🔵 OBSERVATION · dismissed · code-review · `context/changes/2026-09-28-instant-page-shell/spike/measure-nav.mjs` · credentials inlined — they are the local-only e2e OWNER from `src/scripts/e2e-user-credentials.ts`, already committed
- [x] dismissed · module-cohesion-audit · `src/lib/constants/sections.ts` · `PAGE_TITLES` beside section ids — both are the nav's vocabulary, read by the same consumers
- [x] dropped · simplify · 11 list `loading.tsx` · per-file key pick (factory / pathname-driven `RouteLoading`) — the explicit three-line file is idiomatic Next; a client `usePathname` loader would change what the spike measured
- [x] dismissed · simplify (efficiency) · `lib/constants/sections.ts` imports in server `loading.tsx` · no client-bundle weight, prefetch payload +~150 B per route

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 3 applied, 0 proposed, 2 dropped/dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

Rebased onto `staging` (`ff45c69f`), run in the worktree 2026-09-29:

- `pnpm typecheck` — pass (first run failed on a stale gitignored `payload-types.ts` missing staging's `columnRanks`; clean after `pnpm build` regenerated it)
- `pnpm lint` — pass after the ignore above (warnings only, all in untouched files)
- `pnpm test` — 4306 passed, 1 failed: `resolve-id.test.ts` „values follow collection: prefix pattern" rejects `table:kosztorys-snapshots` from staging's `942e3cfe`; fails identically on plain `staging`, not this change
- `pnpm build` — pass
- `pnpm test:e2e` — not run (not requested; no spec asserts a loading fallback)
- Re-measured after the `(dashboard)` route-group move: dashboard title 64 ms local / 78 ms slow4g from the click
