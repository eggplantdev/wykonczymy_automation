# Review-gate ledger — kosztorys-stages-source-of-truth · 2026-07-16

Scope: 4 slice commits `c8dea6f` (p1), `1f0d93e` (p2), `f01fd95` (p3), `c09fbcf` (p4).
Ranges: `d29f1be..1f0d93e` (p1+p2) and `a34d54f..c09fbcf` (p3+p4) — two interloper
commits (`a34d54f` docs, `e0c69e9` netto/brutto icons) excluded.

## Findings

<!-- ONE checkbox per finding. Format:
     [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings also carry a `test:` sub-line. -->

- [x] 🟡 WARNING · fixed · `code-review` · `calc.ts:56` (via `v2-rows.ts:344`) · zero-stage row with an `'amount'` rabat returned NEGATIVE net (`applyDiscount(0)= −discountValue`) instead of 0; also polluted section `net`/`plannedNet` and broke the slice's own "Σ stageValues == rowValue" invariant — FIXED with `if (!(qty > 0)) return 0` guard in `netForQtyForView` (root; also corrects `rowPlannedNetForView` at plannedQty=0 and `rowDiscountForView` at qty=0)
      test: test-driven-debugging · unit — red→green: `netForQtyForView(amount,0)`==0 (calc), `rowValueForView(blank+amount)`==0 (v2-rows); 67 passed
- [x] 🔵 OBSERVATION · dismissed · `impl-review`+`code-review` · `v2-rows.ts:412`, `kosztorys-section-summary.tsx:143,226` · section „udział"/footer grand total anchored on executed `net`, not `plannedNet` (unstarted kosztorys shows all „—") — intended per plan Phase 2 #3 („udział sekcji w tym, co wykonano"); raising the tooltip-wording/UX question to owner, no code change
- [x] 🔵 OBSERVATION · deferred · `code-review` · `kosztorys-v2-columns.tsx:590-600,609,619,711,721` · every stage/value/remaining/percent cell recomputes `rowTotalQtyDone` (O(stages)) per render → O(stages²)/row; viewport-bounded by grid virtualization, non-urgent — filed **EX-498**
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `kosztorys-v2-columns.tsx:688-698` · no-przedmiar row with recorded work renders a red „—" (dash = no denominator, red = overshoot of zero offer) — internally consistent with the model, minor UX glyph ambiguity; noted to owner
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `kosztorys-v2-columns.tsx:604` · column key renamed `measuredQty`→`stageQtySum` vs plan's literal `computedColumn('measuredQty')` — required by Phase 4's `grep measuredQty` clean criterion, semantically identical, label unchanged
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `kosztorys-delete-guard.test.ts` · plan's check 1.3 command runs a spec that is `describe.skipIf(!ENV_READY)` → false-green standalone — plan Progress 1.3 already documents it ran via `pnpm test:integration` (30/30)
- [x] deferred · `module-cohesion` · `v2-rows.ts` · file is a grab-bag — this slice added the settlement-money layer (`rowValueForView`, `rowRemainingForView`, `hasStagesOverPlanned`, `sectionSubtotalsForView`, `planItemRemoval`) + two Polish UI-copy consts (`REMOVE_BLOCK_*`) on top of existing grid/diff/delete-guard utils; placement-in-v2-rows is intentional per docstring, but a dedicated settlement/row-values module is the clean split — filed **EX-499**
- [x] deferred · `simplify` (reuse) · `apply-preset.ts:27-100` ↔ `restore-kosztorys.ts:39-110` · sections→items→stages→progress bulk-INSERT core duplicated verbatim; slice edited both column lists in lockstep (dropping `measured_qty`) — extract shared `insertKosztorysTree` — filed **EX-500**
- [x] dismissed · `simplify` (reuse) · `kosztorys-progress-counter.tsx:35`, `kosztorys-section-summary.tsx:144` · `x>0 ? a/b : null` guard repeated — a `fractionOrNull` helper is low-value; inline ternary is clearer than an import (agent itself did not urge the change)
- [x] skipped · `simplify` (altitude) · `kosztorys-section-summary.tsx:231` · gross computed inline `grandNet*(1+vatRate)` instead of `toGross()` — pre-existing (commit `8832dbc`, 2026-07-13), 7th bypass site, not slice-attributable; a "route all gross through toGross" consistency cleanup is its own task, out of this slice's scope
- [x] dismissed · `simplify` (simplification) · `use-kosztorys-editor.ts:174`, `kosztorys-toolbar-actions.tsx:27` · `totalNet` now means "executed net" (passed as `doneNet`); a `totalExecutedNet` rename reads clearer but is a multi-file naming preference, not a complexity fix — consistent as-is
- [x] tailwind-v4-audit · clean — no findings
- [x] structure-scatter-audit · clean — no scatter introduced
- [x] feature-first-structure · clean — no newly-misplaced files
- [x] comment-noise-audit · clean — 0 deleted/trimmed, 3 flagged-and-kept (load-bearing why)

## Simplify pass

Ran /simplify (4 angles: reuse / simplification / efficiency / altitude) — 0 applied, 1 proposed (bulk-INSERT dedup → filed EX-500), 3 dismissed/skipped; each folded into ## Findings (tagged simplify). Slice is clean on all four angles — a net _reduction_ (deleted `kosztorysDoneNetForView`/`sectionDoneNetForView` + two full-dataset walks). The `netForQtyForView` `qty>0` guard placement was independently confirmed correct by both the altitude and simplification passes. No separate report file — findings live in ## Findings.

## Tests & suite

- Regression tests (test-driven-debugging, unit): 3 authored for the amount-discount-at-zero-qty bug — red→green.
- `pnpm typecheck` — green (post-fix).
- `pnpm exec vitest run src/__tests__/` — **917 passed / 31 skipped** (skipped = ENV_READY integration specs; +3 from the new tests).
- `pnpm lint` — 0 errors, 87 pre-existing warnings (old migration files, none in slice-touched files).
- `pnpm build` — green.
- `test:e2e` — not run (user chose lint + build). Browser E2E owed by the read-only column deferred to backlog **EX-497**.
- Manual browser verification: **pending** — all boxes `[ ]` in `context/foundation/manual-checks.md`. **Archive blocker.**
