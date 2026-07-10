<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: VAT per investment (netto entry, brutto computed)

- **Plan**: context/changes/kosztorys-vat/plan.md
- **Scope**: Full plan (Phase 1 + Phase 2 of 2)
- **Date**: 2026-07-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated criteria re-run at HEAD: `pnpm exec tsc --noEmit` exit 0; `vitest run kosztorys-calc.test.ts` 11/11 pass. Manual rows (1.5–1.7, 2.5–2.9) remain pending — user-owned QA, not rubber-stamped.

## Findings

### F1 — VAT rate has no bounds; negative / absurd values persist silently

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/actions/kosztorys.ts:52
- **Detail**: `investmentVatSchema = z.object({ vatRate: z.coerce.number() })` accepts any finite number — negative (`-0.5`), zero, or absurd (`50` = 5000%). The panel's `CoeffField` (kosztorys-section-summary.tsx:61-69) only guards `Number.isNaN` then commits `n / 100`, so a bad value flows straight to the action and into every brutto figure (`net × (1 + vatRate)` → negative or wildly inflated brutto). NaN/empty are already rejected (zod rejects NaN; UI blocks empty) — the exposure is the _range_, not NaN.
- **Fix**: Bound the schema — `vatRate: z.coerce.number().min(0).max(1)`. A per-investment VAT fraction outside 0–100% is never valid; rejecting at the action stops a bad client persisting it regardless of UI guarding.
- **Decision**: FIXED

### F2 — Cache-tag set narrower than sibling coeff action; comment overstates parity

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/actions/kosztorys.ts:113
- **Detail**: `updateInvestmentVatAction` revalidates `['kosztorysItems']`; the sibling `updateInvestmentCoeffsAction` (:98) uses `['kosztorysItems', 'kosztorysSections']`. The VAT action's comment claims parity with the coeff action but drops `kosztorysSections`. Functionally arguably fine — `vatRate` is read from the investment record and denormalized onto items only, and `handleVatChange` also calls `router.refresh()` — but the comment misrepresents the choice.
- **Fix**: Either match the sibling (`['kosztorysItems', 'kosztorysSections']`) or fix the comment to state why sections is intentionally omitted.
- **Decision**: FIXED (comment corrected; narrow tag kept intentionally)

### F3 — Action takes a bare scalar where sibling takes a typed patch object

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/actions/kosztorys.ts:102
- **Detail**: `updateInvestmentVatAction(investmentId, vatRate: number)` passes a bare scalar and exports no `T`-suffixed type; the sibling `updateInvestmentCoeffsAction(investmentId, patch: InvestmentCoeffsPatchT)` passes a typed patch object. Defensible for a single field — not a defect, just a divergence from the local convention.
- **Fix**: Optional — leave as-is (single-field scalar is fine) or align for consistency.
- **Decision**: SKIPPED (YAGNI — single field, don't fix prematurely)
