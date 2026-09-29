# Review-gate ledger — global-rabat-on-settlement-axis (EX-933) · 2026-09-29

Base: `e98f6b5b` (staging) · branch `global-rabat-on-settlement-axis` · Step 0.5 (browser pass) skipped — Playwright only on explicit request; manual checks live in `context/foundation/manual-checks.md` § EX-933.

## Findings

- [x] 🔵 OBSERVATION · dropped · code-review · `discount-amount-pair-field.tsx` · a brutto on a rounding edge (e.g. 99,999 → 100) — at most one grosz, only for a sub-grosz brutto nobody types
- [x] dropped · simplify · `discount-value-field.tsx` · rename to `PercentDiscountField` with `%` and the schema built in — one caller, generic shape is harmless indirection; rename churn not worth it
- [x] dropped · simplify · `diff-versions.ts:84` · `const [was, now] = [...]` tuple rename — cosmetic
- [x] dropped · reuse-scan · `discount-amount-pair-field.tsx` `parsedAmount` · no parse-non-negative helper exists (`optionalNonNegativeAmount` rejects a comma, `toMoney` returns NaN) — two one-line uses
- [x] dropped · tailwind · pair-field class strings copied from `discount-value-field` — cosmetic
- [x] dismissed · reuse-scan · `discount-amount-pair-field.tsx` · `PlaneAmountField` / `DecimalField` / grid `discountPolicy` — none can replace a linked pair with one „Zapisz" (different storage and commit contracts)
- [x] dismissed · feature-first / scatter · `global-discount-round-trip.test.ts` tested a local copy of the chain — moot now that it calls `discountNetFromGross`
- [x] dismissed · structure · pair-field parsing vs `net-gross-amounts.ts netFromGross` — `Number()` without comma + `toFixed(2)`; not a duplicate
- [x] dismissed · module-cohesion · `change-rows.ts` mixed exports — pre-existing
- [x] dismissed · efficiency · round-trip sweep (~40k iterations, ~0,6 s), history diff, pair-field renders — all negligible

## Simplify pass

Ran /simplify (reuse + primitive-reuse-scan, simplification, efficiency, altitude) — 6 applied, 0 proposed, 5 dropped/dismissed; each finding folded into ## Findings (tagged simplify / reuse-scan). Typecheck + eslint clean, 11 touched spec files / 72 tests green.

## Tests & suite

- typecheck · clean
- eslint (changed files) · clean
- touched specs · 11 files / 72 tests green
- full unit suite, build, e2e · skipped by user (2026-09-29); pre-push runs the unit leg. The e2e specs `kosztorys-presets` and `kosztorys-global-discount-overrides` ran against the old driver shape and have NOT been run since the driver split
