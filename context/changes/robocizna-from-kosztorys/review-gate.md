# Review-gate ledger — robocizna-from-kosztorys (EX-535) · 2026-07-19

Slice diff scope: 10 files, +870/−33 vs `13a81a1f^` (base `ba6674ed`).
Commits: `13a81a1f` (p1) · `8a00f85b` (p2) · `e4285319` (p3) · `d40be6fc` (p4).
Fan-out: `/10x-impl-review`, `/code-review`, `/tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (all read-only);
then `/simplify` (reuse/simplification/efficiency/altitude, mutating).

## Findings

<!-- ONE checkbox per finding. severity tag = bug-finding checks only. source ∈ impl-review | code-review | comment-noise | structure-scatter | simplify. Most-severe first. -->

- [x] 🟡 WARNING · filed EX-541 · `code-review`+`impl-review` (F4) · `kosztorys-podsumowanie.tsx:181` · Recon scream sits next to the **active-view** „Suma prac"/„Rabat" figure while the verdict is client-view-fixed → the screamed number diverges from the tooltip's compared number in non-client price views. Verdict boolean stays correct (Phase-4 E2E guards it). Behavior-changing + owner design call (suppress? relabel? leave?) → deferred.
      test: e2e — assert displayed figure == tooltip's compared figure after a price-view toggle; author with the fix (recorded in EX-541).
- [x] 🟡 WARNING · fixed · `impl-review` (F1) · `plan.md:1` · Plan body still specified gross↔gross while shipped code is net↔net (self-contradicts Phase-4b). Added a correction banner at the top pointing to `reconciliation.ts` as the authority; left the historical body intact.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` (F2) · `reconciliation.ts` · Recon bakes in the net-entry assumption that EX-536/EX-539 question. Not hidden — documented, tracked, and both blockers gate archive. No code owed.
- [x] 🔵 OBSERVATION · fixed · `code-review`+`impl-review` (F3) · `financial-stats.tsx:80`, `page.tsx:67` · Comments said "client-view gross"; model is net. Reworded both to "client-view net".
- [x] 🔵 OBSERVATION · noted (Step 4) · `impl-review` (F5) · Manual Phase-2 checks not yet aggregated / some not E2E-covered → handled by the manual-verification gate (see Tests & suite). Not a code finding.
- [x] fixed · `structure-scatter` · `src/__tests__/kosztorys-reconciliation.test.ts` · Lone flat straggler while the branch migrates flat→nested mirror. `git mv` → `src/__tests__/lib/kosztorys/reconciliation.test.ts` (also drops the redundant `kosztorys-` prefix). 11/11 green after move.
- [x] fixed · `comment-noise` · `kosztorys-podsumowanie.tsx:48` · Trimmed the stale `(Phase 2)` tag.
- [x] dropped · `comment-noise` · `kosztorys-podsumowanie.tsx` (5 borderline flags) · Vanished-state / duplicate-rationale nits the auditor left in place; not worth the churn.
- [x] fixed · `simplify` (reuse+simplification+altitude, 3 agents converged) · `financial-stats.tsx` + `kosztorys-podsumowanie.tsx` · Mismatch "scream" badge (`TriangleAlert` + `aria-label="Niezgodność z transakcjami"`) duplicated verbatim on both surfaces. Extracted `ReconMismatchBadge` (`components/kosztorys/recon-mismatch-badge.tsx`); the E2E-asserted aria-label now lives once and can't drift between the two surfaces the slice designs to read identically.
- [x] filed EX-540 · `simplify` (efficiency) · `page.tsx:70` · `getKosztorysTree` fetched unconditionally on every investment-detail render for 2 scalars (5 queries; wasted entirely for kosztorys-less investments). Both candidate fixes carry a measurement tradeoff → deferred to EX-540.
- [x] dismissed · `simplify` (simplification) · `kosztorys-podsumowanie.tsx:98` · Proposed dropping `|| reconciliation.rabat.mismatch` from `showRabat` as redundant. Kept: it's a defensive term directly encoding "never hide a mismatch"; removing it trades an explicit guarantee for a fragile derivation on a financial-scream surface.
- [x] dropped · `simplify` (simplification) · `kosztorys-podsumowanie.tsx:182,216` · Repeated `x.mismatch ? mismatchTooltip(...) : undefined` ternary. Too minor to warrant a helper; the two sites thread a string through `RowOptsT.mismatch`, so no clean shared form.
- [x] dismissed · `simplify` (altitude F2/F3) · `kosztorys-podsumowanie.tsx:54` · `RowOptsT` color-flag overlap (`danger`/`mismatch`) and `noShareCell` vs `hideShare` are genuinely distinct, well-commented semantics — not smells.

**CLEAN (no findings):** `/tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`; `simplify` altitude confirmed `faceValue`/`moneyPair` split is at the right layer.

## Simplify pass

Ran `/simplify` — 1 applied (badge extraction), 1 filed (EX-540), 2 dismissed, 1 dropped; each folded into ## Findings (tagged simplify). No separate report file (inline fan-out).

## Tests & suite

- Moved `reconciliation.test.ts` → 11/11 green post-move.
- Phase-4 E2E `e2e/kosztorys-reconciliation.spec.ts` (4 tests) authored + green cold in Phase 4; badge extraction is behavior-preserving and the E2E asserts the shared aria-label on both surfaces, so it covers the /simplify change — no new test owed.
- typecheck: clean. lint (touched files): clean.
- Full suite (`typecheck && lint && test && test:e2e && build`): pending user go.

## Archive gate

Blocked — stays **In Review**, NOT archived:

- **EX-536** (zaliczka netto/brutto) + **EX-539** (RABAT transaction netto/brutto) — parked domain blockers, both Urgent, both block EX-535 archive.
- Manual verification (impl-review F5) — owed at Step 4.
  Deferred findings EX-540 / EX-541 are filed (boxes checked), so they do not block.
