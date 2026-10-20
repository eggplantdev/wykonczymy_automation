# Review-gate ledger — investment-initial-info (EX-1120) · 2026-10-20

Scope: `05b6d8911...investment-initial-info` (p1 `86f309cb2` → docs `c47dcbf64`). Step 0.5 (browser
pass) skipped — no browser run unasked.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `src/types/table-rows.ts:46`, `src/lib/queries/shape-investments.ts:82` · `InvestmentRowT` had no `initialInfo` and the shaper dropped it, so „Edytuj” from the inwestycje list crashed on `initialInfo.market` (and failed typecheck) — added to the row type and copied in the shaper
      test: test-driven-debugging · unit — `shape-investments.test.ts` asserts the row carries `{ market: 'secondary' }`
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/investments/investment-render-parity.db.test.ts:89` · fixture literal missing `initialInfo` (TS2322) — `NO_INVESTMENT_INITIAL_INFO` added
      test: no automated test — tsc is the guard
- [x] 🔵 OBSERVATION · fixed · impl-review · `scripts/ai-kosztorys/round-case-prod.ts:116` · first round after release flagged „Rynek: — (puste)” as changed (baseline with no section) — a missing baseline now reads as every field empty (`initialInfoLines(null)`), so clearing a field still shows as a change
      test: no automated test — one-off operator script, DRY run shows it
- [x] 🔵 OBSERVATION · dismissed · code-review · `scripts/ai-kosztorys/initial-info.ts:12` · REST response without `initialInfo` reads as empty — before deploy there is no data to read, so empty is the true answer; a deploy guard would only block rounds until then
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-10-20-investment-initial-info/plan.md:35,93,188` · plan said migration `_1`, „Rynek: wtórny” and `prod-client.ts` — updated to `_2` (staging took `_1`), „Rynek: Rynek wtórny”, `initial-info.ts`
- [x] 🔵 OBSERVATION · skipped · impl-review · `src/migrations/index.ts`, `context/foundation/manual-checks.md` · conflict with staging's `20261020_1_receipt_status_on_money_in` — resolved at the merge (keep both, `_1` before `_2`)
- [x] fixed · code-review · `src/components/forms/investment-form/investment-schema.ts:26` · dead export `InvestmentInitialInfoFormValuesT` removed
- [x] fixed · module-cohesion-audit · `scripts/ai-kosztorys/prod-client.ts:61-81` · initial-info rendering moved to `scripts/ai-kosztorys/initial-info.ts` with a paired `parseInitialInfoMarkdown` reader used by the round baseline
- [x] fixed · comment-noise-audit · `src/components/forms/investment-form/investment-schema.ts:73` · comment trimmed to the one load-bearing clause
- [x] fixed · simplify · `scripts/ai-kosztorys/initial-info.ts:30` · `parseInitialInfoMarkdown` re-implemented the round script's `lines()` — `lines` moved beside `norm` in `prod-client.ts` and reused
- [x] fixed · simplify · `src/collections/investments.ts:49` · collection read market labels around the field map — now via `INVESTMENT_INITIAL_INFO_FIELDS.market.options`, label map no longer exported
- [x] fixed · simplify · `src/__tests__/lib/actions/investment-initial-info.db.test.ts:49` · redundant `purge()` in `beforeAll` (`beforeEach` purges) removed
- [x] fixed · simplify · `scripts/ai-kosztorys/initial-info.ts` · altitude: the empty-line filter was a bandaid hiding cleared fields — replaced by the baseline fix above
- [x] dropped · simplify · `edit-investment-dialog.tsx:75`, `empty-form-values.ts:15` · `toInitialInfoFormValues` like billing's — one field, the helper's body equals the call; add it with the follow-up's second field
- [x] dismissed · simplify · `investment-form.tsx:154` · `<div>` around the site-manager select — the right depth: `Field`'s full-width rule is right for every other control and `ui/select.tsx` is another agent's in-flight edit
- [x] dismissed · simplify · efficiency angle · clean — one extra column on the cached details query, no new round-trip
- [x] dropped · structure-scatter-audit · `edit-investment-dialog.tsx`, `empty-form-values.ts` · `toInitialInfoFormValues` helper for a one-field mapping — params ≈ the code, no win
- [x] dismissed · tailwind-v4-audit · whole diff · clean
- [x] dismissed · feature-first-structure · whole diff · clean

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 4 applied, 0 proposed, 3 dismissed/dropped; folded into ## Findings (tagged simplify). primitive-reuse-scan covered by the reuse angle (form select copies the in-file billing select; no shared enum-select exists).

## Tests & suite

- Red/green: `shape-investments.test.ts` new case red with the shaper line removed, green with it.
- Unit: `shape-investments.test.ts`, `investment-schema.test.ts`, `investments.test.tsx` — 40/40 pass.
- Local migrate (5433): `20261020_2_investment_initial_info` applied.
- Typecheck + eslint: killed mid-run (machine overload) — not run; user chose to merge.
- DB spec `investment-initial-info.db.test.ts`: not run; user chose to merge.
