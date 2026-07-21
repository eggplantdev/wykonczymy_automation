<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Wpłata bucket flag + drop stage link + Do zapłaty netto/brutto

- **Plan**: context/changes/kosztorys-zaliczka-netto-brutto/plan.md
- **Mode**: Deep
- **Date**: 2026-07-21
- **Verdict**: SOUND (after fixes)
- **Findings**: 1 critical, 1 warning, 0 observations

## Verdicts

| Dimension             | Verdict                       |
| --------------------- | ----------------------------- |
| End-State Alignment   | PASS                          |
| Lean Execution        | PASS                          |
| Architectural Fitness | PASS                          |
| Blind Spots           | PASS (was FAIL — F1 fixed)    |
| Plan Completeness     | PASS (was WARNING — F2 fixed) |

## Grounding

Paths 5/5 ✓ (`summary-economics.ts`, `reference-data.ts`, `client-kosztorys.ts`, `kosztorys-summary.tsx`,
`kosztorys-totals-panel.tsx`), symbols 3/3 ✓ (`computeDoZaplatyRM`, `fetchZaliczkiByStage`,
`DEPOSIT_UI_TYPES`), brief↔plan ✓. Confirmed: rabat/materiały math preserved (labor arrives po rabacie,
materiały at face both axes); two `MoneyAxisToggle` render paths (collapsed headline + expanded grid);
`fetchZaliczkiByStage` is the sole `unstable_cache` deposit-read wrapper; `noBrutto` shared; picker trim
closes the model at the source (single consumer `deposit-form.tsx`).

## Findings

### F1 — Legacy (`null`-plane) wpłaty grossed on the brutto axis by the fold-into-net model

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — the model determines a real client-facing obligation figure; wrong = the client is shown the wrong „Do zapłaty".
- **Dimension**: Blind Spots
- **Location**: Overview calc model + Phase 3 `computeDoZaplatyRM`
- **Detail**: The plan's earlier model folded legacy (`null`) wpłaty into `baseLeft` alongside `sumNet`
  (`baseLeft = R − sumNet − legacySum`). On the **brutto** axis that grosses legacy with the remainder,
  so a legacy-only investment (R 2000, legacy 1000) showed brutto `1000×1,08 = 1080` — but the pre-change
  code produced `toGross(2000) − 1000 = 1160`. The old code subtracted every wpłata at **face** on the
  gross axis; the fold model silently changed a shipped number. The owner is firm: legacy is old data and
  must render **identically** to the pre-change code on **both** axes.
- **Fix (applied)**: Legacy is removed from `baseLeft` and subtracts **at face on both axes**:
  `net = baseLeft − legacySum + M`, `gross = baseLeft × (1+vat) − sumGross − legacySum + M`, with
  `baseLeft = R − sumNet`. Only the flagged netto/brutto buckets drive the sequential model. Legacy-only
  case now reproduces the old figures exactly (netto 1000, brutto 1160). No backfill.
- **Decision**: FIXED (model corrected across plan.md, change.md, plan-brief.md, design-bilans-vat-planes.md)

### F2 — Existing `summary-economics.test.ts` asserts the old `computeDoZaplatyRM` signature

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; the fix is obvious and narrowly scoped.
- **Dimension**: Plan Completeness
- **Location**: Phase 3
- **Detail**: `summary-economics.test.ts` calls `computeDoZaplatyRM(labor, wplatyNet, mat, vat)`. Phase 3
  changes the signature to `computeDoZaplatyRM(labor, { sumNet, sumGross, legacySum }, mat, vat)`. The plan
  originally said only „Keep `summary-economics.test.ts:52-62`", which would leave a compile-breaking test.
- **Fix (applied)**: Phase 3 now carries an explicit test-update step — migrate the assertions to the new
  `{ sumNet, sumGross, legacySum }` shape and add the legacy-at-face case (R 2000, legacy 1000 → net 1000,
  gross 1160). Phase 1's „Keep :52-62" note now cross-references Phase 3's rewrite.
- **Test disposition**: unit — the regression guard is the legacy-at-face case itself, authored alongside the fix.
- **Decision**: FIXED
