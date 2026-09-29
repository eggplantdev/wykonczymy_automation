# Review-gate ledger — global-rabat-on-settlement-axis (EX-933) · 2026-09-29

Base: `e98f6b5b` (staging) · branch `global-rabat-on-settlement-axis` · Step 0.5 (browser pass) skipped — Playwright only on explicit request; manual checks live in `context/foundation/manual-checks.md` § EX-933.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `e2e/drivers/settlement.ts:73` · „Kwotowy" now renders two textboxes, so the driver's bare `getByRole('textbox')` breaks Playwright strict mode in `kosztorys-presets.spec:204` and `kosztorys-global-discount-overrides.spec:133` — split into `applyDiscountAmount` (by label „netto") / `applyDiscountPercent` (simplify + altitude replaced the interim `.first()`)
      test: no automated test · e2e — the existing specs are the guard once the driver is fixed (not run; e2e only on request)
- [x] 🟡 WARNING · fixed · impl-review F1 · `use-kosztorys-settings.ts:255` · the six-place save was unpinned — a revert to grosze would silently bring EX-933 back
      test: TDD · dom — hook spec asserts `discountNetFromGross(5000, 0.08)` reaches the action as 4629.62963
- [x] 🔵 OBSERVATION · fixed · impl-review F2 · `discount-amount-pair-field.tsx` · netto entry not rounded to grosze — `roundToCents` on the netto axis
      test: TDD · dom — '1000,006' typed in netto → `onApply(1000.01)`
- [x] 🔵 OBSERVATION · fixed · impl-review F3 · `context/foundation/roadmap.md:463` · the wrong question (Q2, the `RABAT` transaction axis) was marked resolved, plus a dangling EX-539 mention — Q2 restored with the kosztorys side noted as settled
- [x] 🔵 OBSERVATION · fixed · code-review · `discount-amount-pair-field.tsx` · „Zapisz" enabled on the stored kwota re-typed with a comma (`String()` vs pl-PL text) — display through `decimalText`
      test: TDD · dom — `renderField(1000.5)` shows '1000,5', re-typing it leaves „Zapisz" disabled
- [x] 🔵 OBSERVATION · dropped · code-review · `discount-amount-pair-field.tsx` · a brutto on a rounding edge (e.g. 99,999 → 100) — at most one grosz, only for a sub-grosz brutto nobody types
- [x] fixed · code-review · `discount-value-field.tsx` · dead `value` / `seenValue` / `clearOnApply` and stale kwota comments after the pair field took the kwota mode (+ `decimal-field.tsx:42`)
- [x] fixed · simplify · `discount-amount-pair-field.tsx` · `net` / `gross` / `edited` were three states for one fact and `typeNet`/`typeGross` a mirror pair — one `draft {axis, raw}`, counterpart derived
- [x] fixed · simplify (altitude) · `use-kosztorys-settings.ts:255` · brutto precision lived in the hook (which knows no axis) behind a stale "seeded Σ carries residue" reason (`perItemDiscountTotal` is already grosze) — `discountNetFromGross` in `lib/kosztorys/calc.ts` owns it; the field calls it, the hook stops rounding; round-trip spec now exercises the real helper instead of a local copy
- [x] fixed · simplify · `discount-value-field.tsx` · dead `label` prop (no caller passes it, its comment described the removed kwota mode) and the dead `| void` arm of `onApply`
- [x] fixed · simplify · `global-discount-control.tsx` · `vatRate` threaded as a prop although the editor context has `tree` (as `VatRateField` reads it) — read from context, `summary-investment-settings.tsx` back to base
- [x] fixed · reuse-scan + simplify · `discount-amount-pair-field.tsx:21` · `moneyText` duplicated `priceText` in `grid/cells/subcontractor/cell-data.ts` — one `moneyText` in `lib/utils/decimal-text.ts`, both callers repointed
- [x] fixed · comment-noise · `discount-amount-pair-field.tsx` header trim + "Compared as text" deleted; hook comment trimmed; round-trip spec header deleted
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
