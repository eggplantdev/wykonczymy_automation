---
date: 2026-07-20T18:05:00+02:00
researcher: ex-Plant
git_commit: 2562a2e1a25932fc5172d052d73c2f75f5f099a8
branch: staging
repository: wykonczymy
topic: "Kosztorys domain terminology cleanup — code-grounded drift inventory + classification (l5 „język" step / EX-548)"
tags: [research, codebase, kosztorys, domain-naming, ex-548, plane-suffix, distillation]
status: complete
last_updated: 2026-07-20
last_updated_by: ex-Plant
---

# Research: Kosztorys domain terminology cleanup (l5 „język" step / EX-548)

**Date**: 2026-07-20T18:05:00+02:00
**Researcher**: ex-Plant
**Git Commit**: 2562a2e1a25932fc5172d052d73c2f75f5f099a8
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Gate #1 of the `kosztorys-terminology` slice (owner: "wymuszamy research", "z kodu
nie z pamięci"): before executing the EX-548 Polish→English identifier rename,
establish on **code (file:line)** — not memory, not the stale distillation — (1) a
fresh domain distillation, (2) the true drift inventory, (3) an A/B1/B2/gray
classification with the B2 plane-suffix pairs identified, (4) the two open
owner-decisions surfaced but unresolved. See `frame.md` (four dimensions) and
`change.md` (the three non-negotiable gates).

## Summary

Four parallel code-grounded sub-agents (A distillation, B inventory, C
classification, D pomiar/przedmiar). Headline findings:

1. **The distillation was the drift.** The 2026-07-08 `01-domain-distillation.md`
   claimed the Kosztorys Item aggregate was "BRAK w kodzie" and ranked building it
   #1. It is built and its headline invariants are enforced by construction.
   **Regenerated from scratch** (gate #3, done this pass) →
   `context/domain/01-domain-distillation.md`.
2. **The EX-548 inventory is incomplete.** All 27 catalogued symbols are still
   present (0 renamed). But **≥8 uncatalogued drift identifiers** exist — biggest
   is `sumaPracNet` (~39 occurrences). True distinct drift ≈ 35, not 27.
3. **The glossary's plane table is wrong in two places** (dim 3 — the highest-risk
   dimension). (a) It names only ONE B2 recon pair (labor); the recon compares
   **two** figures cross-plane — **rabat is also B2** and a bare `discount*` rename
   would repeat exactly the mistake the glossary's own footnote warns about. (b) On
   the labor pair it names the wrong kosztorys operand: the recon compares the
   **pre-rabat** `sumaPracNet`, not the post-rabat `laborCostsNetFromKosztorys`.
4. **`przedmiar`/`pomiar` A-or-B is largely moot** (dim 2): they are NOT code
   identifiers — code already uses English `plannedQty` / `stageQtySum` /
   `rowTotalQtyDone`. Glossary rows 116-117 (marked Cat A, "Drift: —") contradict
   the code. Nothing to rename or keep; the "pomiar lies" concern is already
   mitigated in code (honest identifiers + tooltip).

Confidence: the four dimensions the frame flagged are now resolved on code — dim 3
(plane collisions) and dim 4 (model staleness) were STRONG and are confirmed +
corrected; dim 1 (inventory completeness) was WEAK and is now closed (8 more
found); dim 2 (`przedmiar`/`pomiar` category) was WEAK and is now largely moot.

## Detailed Findings

### 1. Drift inventory — code-verified (Agent B)

- **All 27 EX-548-catalogued symbols still PRESENT** — the rename has not started.
- **Glossary "resolved 2026-07-20" rulings are TRUE in code** for
  `podsumowanie→summary`, `robocizna→laborCosts`, `lacznie→combined` (genuinely
  landed; Polish survives only in UI labels). `etap→stage` correctly marked partial
  — `KosztorysEtapTotals` + `kosztorys-etap-totals.tsx` + `orphaned-etap-tag` still
  drift.
- **eslint guard confirmed OFF** — `eslint.config.mjs:146-147` (rule + `DOMAIN_DRIFT`
  array + config block all commented, `TODO(EX-548)`). Re-enable = pure uncomment =
  slice DoD.
- **8 uncatalogued drift identifiers** (true total ≈ 35):
  - `sumaPracNet` — **~39 occurrences, the biggest miss** (`use-kosztorys-editor.ts:339`,
    `settlement.ts:24,66`, `kosztorys-summary.tsx:106`, `reconciliation.ts:73`)
  - `doZaplaty` (13), `computeDoZaplatyRM` (10) — `summary-economics.ts:67`,
    `kosztorys-totals-panel.tsx:65`
  - `materialyNet` (12) — **half-renamed seam**: `kosztorys-editor-body.tsx:202`
    passes English `materialsNet` into Polish prop `materialyNet`
  - `noBrutto` (5), `showPoza` (2), `sumaPrac` (2), `SUMA_PRAC_NET` (1+)

### 2. Per-symbol classification A / B1 / B2 / gray (Agent C)

Verified read-only against glossary + AGENTS.md "Naming a financial figure" rules.

| Symbol                                                                                                                | Cat                   | Target                                                                                   | Note                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kosztorys` (slug `kosztoryses`)                                                                                      | A                     | keep                                                                                     | Sheet proper noun, `sheets.ts:13`                                                                                                                                                            |
| `przedmiar` / `pomiar`                                                                                                | A                     | keep (moot)                                                                              | Not code identifiers — see §4                                                                                                                                                                |
| `bilans` (local)                                                                                                      | B1                    | `balance`                                                                                | `print-button.tsx:35`, `audit-investment-parity.ts:39,48`; canonical `calculateBalance` exists                                                                                               |
| `marza` (local)                                                                                                       | B1                    | `margin`                                                                                 | `audit-investment-parity.ts:40,49`; canonical `calculateMargin` exists                                                                                                                       |
| `wyplaty` (local)                                                                                                     | B1                    | `payouts`                                                                                | `audit-investment-parity.ts:43,52`                                                                                                                                                           |
| `wplatyNet`                                                                                                           | B1, **bare**          | `depositsNet`                                                                            | Transactions-plane only (`= totalIncome`, `page.tsx:51`); no kosztorys deposits figure → NO suffix                                                                                           |
| `zaliczki*` family (`ZaliczkaRowT`, `sumZaliczkiByStage`, `fetchZaliczkiByStage`, `zaliczkiByStage`, `zaliczkiTotal`) | B1, **bare**          | `depositsByStage` / `sumDepositsByStage` / `fetchDepositsByStage` / `stageDepositsTotal` | One plane (tagged deposit transfers). `pozaEtapem = wplatyNet − zaliczkiTotal` (`kosztorys-etap-totals.tsx:56`) is a within-plane subset split, NOT cross-plane → not B2                     |
| `pozaEtapem`                                                                                                          | B1                    | `unstagedDeposits`                                                                       | `kosztorys-etap-totals.tsx:56`                                                                                                                                                               |
| `rabatAmount`                                                                                                         | B1 ⚠                  | **collides**                                                                             | `use-kosztorys-editor.ts:366`; glossary's target `discountAmount` is already occupied by a different figure at `:351` → needs a distinct name                                                |
| `itemRabatTotal`                                                                                                      | B1                    | `itemDiscountTotal`                                                                      | `use-kosztorys-editor.ts:362`                                                                                                                                                                |
| `rabatClientNet`                                                                                                      | **B2**                | `discountNetFromKosztorys`                                                               | Recon operand — see §3                                                                                                                                                                       |
| `investmentRabat`                                                                                                     | **B2**                | `discountNetFromTransactions`                                                            | Recon operand — see §3                                                                                                                                                                       |
| `totalRabat`                                                                                                          | B1, **bare**          | `totalDiscount`                                                                          | `investment-financials.ts:13`; ledger aggregate at source (like `totalLaborCosts`) → bare. ⚠ Glossary rows 72-74 treat it as canonical, but it violates rule 3 (Polish root + English affix) |
| `KosztorysEtapTotals` / `kosztorys-etap-totals.tsx`                                                                   | B1                    | `KosztorysStageTotals` / `…-stage-totals.tsx`                                            | `kosztorys-etap-totals.tsx:40`                                                                                                                                                               |
| `sumaPracNet`                                                                                                         | **B2 operand / gray** | see §3 note                                                                              | `use-kosztorys-editor.ts:339` — the actual kosztorys-side labor recon operand; glossary's assigned name is taken                                                                             |
| `wykonaneNet`                                                                                                         | B1                    | `executedNet`                                                                            | `kosztorys-etap-totals.tsx:33`                                                                                                                                                               |
| `computeDoZaplatyRM` / `doZaplaty`                                                                                    | gray                  | `computeAmountDueRM`?                                                                    | `summary-economics.ts:67` — named sheet footer row (r456-464); "amount due" is a clean equivalent → owner's call, missing from glossary                                                      |
| `totalLaborCosts`                                                                                                     | B, **bare**           | keep                                                                                     | `investment-financials.ts` aggregate at source; suffix only at the seam (`page.tsx:64`)                                                                                                      |

### 3. B2 recon-counterpart pairs — plane-suffix, NOT language-swap (Agent C)

`buildKosztorysReconciliation` (`reconciliation.ts:66-76`) compares **exactly two**
figures cross-plane; **both are B2**:

**Pair 1 — labor charge (known, but glossary names the wrong operand):**

- `reconciliation.ts:73` — `laborCosts: reconcile(sumaPracNet, laborCostsNetFromTransactions)`
- Transactions side: `laborCostsNetFromTransactions` ← `financials.totalLaborCosts`
  (Σ LABOR_COST) at `page.tsx:64`, `investment-recon-block.tsx:53`. Already canonical.
- Kosztorys side: **the operand is `sumaPracNet` (pre-rabat), NOT
  `laborCostsNetFromKosztorys` (post-rabat)**. `sumaPracNet = laborCostsNetFromKosztorys
  - rabatAmount` (`kosztorys-summary.tsx:105-106`). Two distinct figures. The
glossary plane table (`02-glossary.md:87-89`) assigns the suffixed name to the
wrong one — a blind rename per that table suffixes the figure the recon does NOT
compare. **Owner/EX-548 decision needed:** which figure earns
`…FromKosztorys`, and what the other becomes.

**Pair 2 — discount (MISSED by the glossary's plane table):**

- `reconciliation.ts:74` — `rabat: reconcile(rabatClientNet, investmentRabat)`
- Kosztorys side: `rabatClientNet` → **`discountNetFromKosztorys`**
- Transactions side: `investmentRabat` ← `financials.totalRabat` (Σ RABAT) →
  **`discountNetFromTransactions`**
- Glossary (`02-glossary.md:49,71-75`) classifies all `rabat*` as plain B1
  language-swaps and lists only labor in the plane table. But the recon compares
  rabat cross-plane by design (verdict key `rabat`, `reconciliation.ts:18`) — a
  bare `discountClientNet` / bare `totalRabat` repeats exactly the mistake the
  glossary's own footnote warns against (`02-glossary.md:100-101`: "a language
  ruling does not settle the plane question"). The verdict **key `rabat` should
  also become `discount`** alongside the existing `laborCosts` key.

**Explicitly NOT B2 (keep bare):** `zaliczkiByStage` family, `wplatyNet`,
`totalLaborCosts`, `totalRabat`, `wykonaneNet` — each one plane only. The deposits
"recon" (`kosztorys-etap-totals.tsx:56`) is a subset-vs-total split within the
transactions plane; `computeDoZaplatyRM` _mixes_ planes arithmetically but compares
nothing.

### 4. `przedmiar` / `pomiar` — the A-or-B question is largely moot (Agent D)

- **Neither is a code identifier.** Code uses `plannedQty` (`kosztorys-items.ts:38`),
  `stageQtySum` / `rowTotalQtyDone` (`settlement.ts:72`, `column-config.ts:14`);
  Polish lives only in UI labels/comments. Glossary rows 116-117 (Cat A, "Drift: —")
  contradict the code — **they need correcting**, but there is nothing to rename or
  keep.
- **The pomiar name-vs-meaning drift is already mitigated in code.** „Pomiar z
  natury" (sheet O) is a formula `=SUM(D:M)` = Σ stages, not a field measurement.
  `measured_qty` was created (`20260708_2`) then dropped (`20260716_0`, EX-494/489);
  the identifier is the honest `rowTotalQtyDone`; a tooltip explains it
  (`header-tips.ts:18`). „Pozostało" deliberately anchors to `plannedQty`
  (`settlement.ts:97-113`), a documented parity break with the sheet's dead AF column.
- **Two owner-decisions surfaced (NOT resolved here):** (a) confirm `przedmiar`/`pomiar`
  stay Cat A as UI labels even though no identifier carries them; (b) whether the
  UI label „Pomiar z natury" should change since the figure is a stage sum — a
  labels question, out of this slice's rename scope.

## Code References

- `src/lib/kosztorys/reconciliation.ts:66-76` — the two-operand cross-plane recon (both B2)
- `src/lib/kosztorys/settlement.ts:16-74,88-114` — done-net triple, pomiar=Σstages, Pozostało anchored to plannedQty
- `src/components/kosztorys/use-kosztorys-editor.ts:339,351,357,362,366` — `sumaPracNet`, `discountAmount` (collision), `laborCostsNetFromKosztorys`, `itemRabatTotal`, `rabatAmount`
- `src/lib/kosztorys/summary-economics.ts:45-78` — `combined`, `materialyNet` (half-rename), `computeDoZaplatyRM`, `wplatyNet`
- `src/collections/kosztorys-items.ts:5,38,41` — `plannedQty`, `clientPrice` snapshot
- `src/collections/sheets.ts:13,44-50` — slug `kosztoryses`, `googleSheetId` required+unique on death row
- `eslint.config.mjs:20-50,140-148` — the commented drift guard (DoD to re-enable)
- `context/domain/02-glossary.md:49,71-75,87-89,100-101,116-117` — the rows this research corrects

## Architecture Insights

- The rename is **type-aware/tsc-gated mechanical work** for the B1 majority, but
  **B2 and the collisions are NOT mechanical** — `sumaPracNet` (operand identity),
  `rabatAmount` vs `discountAmount` (name collision), and both B2 pairs need a
  naming decision before any codemod runs. A blind glossary-driven rename would
  ship the wrong suffix on the labor pair and lose the rabat plane distinction.
- The glossary (`02-glossary.md`) is itself partially stale — the plan phase owes
  four corrections: rows 116-117 (przedmiar/pomiar not drift), rows 72-74
  (`totalRabat` isn't canonical, violates rule 3), rows 87-89 (labor operand is
  `sumaPracNet` not the post-rabat figure), rows 49/71-75 (rabat is B2 not B1).
- The distillation's #1 refactor is now **structural, not naming**: the "≥1 item"
  floor is client-only while server delete actions are unguarded. Out of scope for
  this slice (it's the invariants slice) but recorded in the regenerated distillation.

## Historical Context (from prior changes)

- `context/changes/kosztorys-terminology/change.md` — the arc spine (4 slices) + 3 gates
- `context/changes/kosztorys-terminology/frame.md` — the four dimensions this research resolves
- EX-489/EX-494 — pomiar=Σstages, `measured_qty` dropped (`20260716_0_drop_kosztorys_measured_qty.ts`)
- EX-477 (commit `5908fb8a`) — populated-delete hard-block relaxed to confirm+snapshot
- EX-410 canceled (git `76dd757`) — negative register balance is a client decision, not a gap

## Open Questions (owner-decisions — do NOT resolve in this slice)

1. **Labor B2 operand naming.** Which figure earns `laborCostsNetFromKosztorys`
   (pre-rabat `sumaPracNet` = the recon operand, or the post-rabat summary figure
   currently holding that name)? What does the other become?
2. **`rabatAmount` collision.** Its glossary target `discountAmount` is taken by a
   different figure in the same hook. New name needed (e.g. `displayDiscountNet`).
3. **`computeDoZaplatyRM` / `doZaplaty`** — Cat gray, missing from glossary. Sheet
   footer row „do zapłaty R+M" but "amount due" is a clean English equivalent →
   likely B1 `computeAmountDueRM`, owner confirms.
4. **`przedmiar`/`pomiar` Cat A** — confirm they stay Cat A as UI labels though no
   identifier carries them; and whether the „Pomiar z natury" UI label should change
   given the figure is a stage sum (labels question, out of rename scope).

## Related Research

- `context/domain/01-domain-distillation.md` — regenerated this pass (KROK 0–5 on code)
- `context/domain/02-glossary.md` — the canonical map this research flags for four corrections
