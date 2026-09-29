# Review-gate ledger — instant-page-shell (EX-877) · 2026-09-29

Scope: staged diff in worktree `instant-page-shell` vs base `d4301ba8`. Checks: code-review,
comment-noise-audit (flag-only), tailwind-v4-audit, feature-first-structure + module-cohesion-audit +
structure-scatter-audit. `/10x-impl-review` dropped — the change has no `plan.md` (spike → change,
decisions in `change.md`). Verification pass: covered by the owner's hands-on check of both builds
(2026-09-28, loader position fixed from it) and the two measured runs in `spike/results.md`.

## Findings

- [x] 🔵 OBSERVATION · dropped · code-review · `src/app/(frontend)/(dashboard)/loading.tsx` · an EMPLOYEE sent to a page that redirects them (`/` → `/kasa/[id]`) sees that page's title for the redirect's duration — cosmetic, the redirect chain predates this change and the 🚧 was shown there before
      test: no automated test — cosmetic transient, no data or access at stake
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/nav/mobile-nav.tsx` · comment still described the reverted mount prefetch — rewritten to the close-on-commit rationale
- [x] 🔵 OBSERVATION · dismissed · code-review · `context/changes/2026-09-28-instant-page-shell/spike/measure-nav.mjs` · credentials inlined — they are the local-only e2e OWNER from `src/scripts/e2e-user-credentials.ts`, already committed
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/dashboard/manager-dashboard.tsx` · two imports from `lib/constants/sections` — merged
- [x] fixed · comment-noise · `context/changes/2026-09-28-instant-page-shell/spike/measure-nav.mjs` · three comments restating the code — deleted
- [x] fixed · comment-noise · `src/components/ui/loader/page-loading.tsx` · typo in the `DetailPageLoading` comment — gone with the rewrite
- [x] fixed · tailwind-v4-audit · `src/components/ui/loader/page-loading.tsx` · `DetailPageLoading` duplicated `TitledPageLoading`'s layout — now reuses it with an `h-lh` bar as title (`PageWrapper.title` widened to `ReactNode`)
- [x] dismissed · module-cohesion-audit · `src/lib/constants/sections.ts` · `PAGE_TITLES` beside section ids — both are the nav's vocabulary, read by the same consumers
- [x] fixed · structure-scatter-audit · `context/changes/2026-09-28-instant-page-shell/spike/` · raw run dumps committed under `context/` — deleted, `measure-nav.mjs` regenerates them
- [x] fixed · simplify · `src/app/(frontend)/loading.tsx` · the fallback every untitled segment inherits was titled „Transakcje" — dashboard moved to a `(dashboard)` route group with its own titled `loading.tsx`; the root one is back to the untitled `PageLoading` (also makes the `@investmentCrumb/loading.tsx` comment true again)
- [x] fixed · simplify · `src/components/ui/loader/loader.tsx:27` · 🚧 glyph copied from `ContentLoading` — `Loader` now renders `ContentLoading`
- [x] fixed · simplify · `src/components/ui/loader/page-loading.tsx:32` · comment claimed „nothing below jumps", but `sprzet/[id]` / `flota/[id]` add a description line — reworded to what the bar actually holds
- [x] dropped · simplify · 11 list `loading.tsx` · per-file key pick (factory / pathname-driven `RouteLoading`) — the explicit three-line file is idiomatic Next; a client `usePathname` loader would change what the spike measured
- [x] dismissed · simplify (efficiency) · `lib/constants/sections.ts` imports in server `loading.tsx` · no client-bundle weight, prefetch payload +~150 B per route

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 3 applied, 0 proposed, 2 dropped/dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite
