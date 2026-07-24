# Review-gate ledger — kosztorys-global-discount · 2026-07-16

## Findings

<!-- ONE checkbox per finding. Most-severe first. -->

- [x] 🟡 WARNING · fixed · `impl-review`+`code-review` · `use-kosztorys-editor.ts:508` · optimistic desync — toggle patched the row flag but total + columns read the pre-refresh `tree.globalDiscount`, so "Do zapłaty" flashed wrong until `router.refresh()`. Fix: local optimistic `globalDiscount` state drives the memo + `columnOpts` + panel, so all three surfaces move in one render.
      test: no automated test — transient optimistic render-timing window, no clean layer below browser; steady-state ("obie sumy zgodne") guarded by the manual §EX-501 check.
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `v2-rows.ts:21`→`calc.ts:17` · `isGlobalDiscountActive` failed open on an unknown persisted type (flag active, nothing subtracted). Fix: guard `type==='percent'||type==='amount'`.
      test: TDD · unit — `kosztorys-calc.test.ts` "nieznany, uszkodzony tryb → fail closed".
- [x] 🔵 OBSERVATION · fixed · `code-review`+`impl-review` · `section-summary.tsx:253` · brutto computed inline `*(1+vatRate)` while the sibling totals bar uses `toGross()` — the two "never disagree" surfaces on different code paths. Fix: routed through `toGross()`.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `totals-bar.tsx:39` · netto "Suma netto · − Rabat" breakdown rendered in a gross-only axis. Fix: gated on `showNet`.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `actions/kosztorys.ts:59` · percent > 100 unbounded → negative payable. Consistent with per-item rabat (also unbounded); input semantics, no floor by design.
      test: no automated test — deliberately unguarded, matches existing per-item behavior.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `calc.ts:163` · amount > executed → negative payable early in a job. Intentional per code comment + owner model (do zapłaty = executed − rabat, negative surfaces bad input rather than flooring).
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `investments.ts:113` · `globalDiscountValue` lacks `required`. By design — matches the `vatRate` rail; adding `required` would make it mandatory in the generated input type (the vatRate learning). NOT NULL is enforced by the migration.
- [x] fixed · `structure-scatter` · `v2-rows.ts:21`→`calc.ts:17` · `isGlobalDiscountActive` split from its sibling `globalDiscountAmount`; both pure `GlobalDiscountT` helpers imported by the same consumer. Co-located into `calc.ts` (same edit as the fail-open guard).
- [x] skipped · `feature-first` · `global-settings.tsx:28` / `section-summary.tsx:22` · inline `{wTools,ownTools}` vs the named `KosztorysGlobalCoeffsT`. Pre-existing prop shape, not slice-introduced — out-of-scope churn.
- [x] fixed · `comment-noise` · `use-kosztorys-editor.ts:603` · deleted return-object grouping label (restated self-named props).
- [x] fixed · `comment-noise` · `types/kosztorys.ts:118` · deleted comment restating `globalDiscountActive`.
- [x] fixed · `comment-noise` · `totals-bar.tsx:17` · trimmed header narration, kept the cross-surface coupling why.
- [x] fixed · `comment-noise` · `use-kosztorys-editor.ts:190` · trimmed trailing arithmetic narration, kept the "never disagree" why.
- [x] dismissed · `comment-noise` · 6 borderline comments — carry real why (null-mapping, netto/procent unit semantics, migration backfill); left in.

**Clean passes (no findings):** `tailwind-v4-audit`, `module-cohesion-audit`.

**Also applied (user request, mid-review):** swap the mode-select order → `kwota zł` before `procent %` (`global-settings.tsx`).

## Simplify pass

Ran /simplify — 0 applied, 0 proposed, 0 dismissed; all four angles (reuse / simplification / efficiency / altitude) returned clean. The review-fix pass had already folded in the cleanups they'd flag (`isGlobalDiscountActive` co-located into `calc.ts`, inline `*(1+vatRate)` routed through `toGross`, comment-noise trimmed). Nothing to fold into ## Findings.

- [x] dismissed · simplify · `use-kosztorys-editor.ts` · altitude agent noted the hook now holds three optimistic `tree` mirrors (`rows`/`stages`/`globalDiscount`) — a consistent pattern, not a special case; consolidation into one optimistic-tree object only warranted if a 4th field appears. Out of scope for a fix pass, flagged as future direction.

## E2E obligation (browser-level slice)

- [x] deferred · e2e · browser-level slice owes a Playwright spec (mode-select hides rabat columns via grid remount; both total surfaces agree in one render — the optimistic-desync boundary). Filed EX-502 (`e2e-backlog`, project Wykonczymy), Refs EX-501. Unit math already covered in `kosztorys-calc.test.ts`.

## Tests & suite

Fast legs (user chose over full suite; e2e deferred to EX-502, `next build` skipped):

- `pnpm typecheck` — ✅ clean (tsc --noEmit, 0 errors)
- `pnpm exec vitest run kosztorys-calc + kosztorys-v2-rows` — ✅ 76 passed (34 calc incl. 3 new `isGlobalDiscountActive`, 42 v2-rows)
- `pnpm lint` — ✅ 0 errors, 87 warnings (all pre-existing `src/migrations/*` unused-arg; none in slice files)
