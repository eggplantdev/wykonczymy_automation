---
date: 2026-07-19T09:04:07+0200
researcher: ex-Plant
git_commit: 5ac2b75b9498dd7245592aaa4a7d6026aeb6e5f4
branch: kosztorys-bridge
repository: wykonczymy
topic: 'Derive investment robocizna from the kosztorys executed-work total instead of a manual LABOR_COST transfer'
tags: [research, codebase, kosztorys, robocizna, transfers, marża, FR-015]
status: complete
last_updated: 2026-07-19
last_updated_by: ex-Plant
---

# Research: robocizna from the kosztorys (retiring the LABOR_COST workaround)

**Date**: 2026-07-19T09:04:07+0200
**Researcher**: ex-Plant
**Git Commit**: 5ac2b75b9498dd7245592aaa4a7d6026aeb6e5f4
**Branch**: kosztorys-bridge
**Repository**: wykonczymy

## Research Question

Make investment-page **robocizna** derive from the kosztorys executed-work total
(„Suma prac wykonanych") instead of a manually-entered `LABOR_COST` transfer. Determine the exact
current sources, whether any bridge already exists, what would have to change, and whether the
`LABOR_COST` transfer should be retired. Owner is leaning on: **robocizna should probably not be a
transaction at all**, and the derived figure should map to a **brutto** value (client-at-netto = the
`vatRate = 0` case).

## Summary

Two numbers describe the same real-world quantity (the labor the company bills the investor) but are
**wholly independent in code** — any agreement today is manual data entry:

- **Investment robocizna** = `totalLaborCosts` = Σ of transfer rows of type `LABOR_COST`
  (`src/lib/db/investment-financials.ts:44`). A **hand-typed** figure — `LABOR_COST` is the only
  transfer type whose amount is editable after create (`src/lib/actions/transfers.ts:259-262`).
- **Kosztorys „Suma prac wykonanych"** = `totalNet` = Σ section subtotals at the active price view,
  pre-rabat (`src/components/kosztorys/use-kosztorys-editor.ts:285-287`) = Σ etapów (executed, not
  offered Przedmiar).

**No code path connects them.** This is by design: the `kosztorys-bridge` arc is explicitly
"live join, **no write-back, no sync**" (`kosztorys-bridge/change.md:15,21`), guarded by the FR-015
write firewall. The proposed change **is** the parked P5 convergence — deriving robocizna from the
kosztorys is the deliberate act of opening that firewall, an owner decision.

`LABOR_COST` is **split** on retire-ability:

- **Cash/register plane — inert, safe.** It has no source/target register; the recalc hook only
  busts caches, never moves a balance (`src/hooks/transfers/recalculate-balances.ts:31-44`).
- **Cancellation/audit — generic, safe.** The cancel path is type-agnostic; nothing is
  `LABOR_COST`-specific (`src/lib/actions/transfers.ts:189-227`).
- **Financial computation — load-bearing.** It is the positive base of marża **and** bilans. Retiring
  the type doesn't remove the need for the number; it forces the number to come from the kosztorys.
- **Google Sheets — load-bearing, position-frozen.** `LABOR_COST` owns a fixed SUMIF summary column
  on the `transfery` tab. Per the frozen-contract lesson, the column slot must survive as a
  0-placeholder (like the retired Korekta column) or old-investment sheet formulas shift and break.

## Detailed Findings

### FIGURE A — investment robocizna is typed `LABOR_COST` transfers

- Source of truth: `src/lib/db/investment-financials.ts:44` —
  `totalLaborCosts: sumRows(rows, (r) => r.type === 'LABOR_COST')`. Single line; `deriveFinancials`
  feeds both the listing aggregate (`src/lib/db/sum-transfers.ts:209`) and the detail page.
- Type: `src/collections/transfers.ts:22` (`'LABOR_COST'`, label „Koszty robocizny"). No source
  register — `needsSourceRegister` excludes it (`src/hooks/transfers/transfer-rules.ts:53`;
  `validate.ts:53-61` auto-nulls `sourceRegister`).
- Manually typed: only `LABOR_COST` amounts are editable post-create
  (`src/lib/actions/transfers.ts:259-262`).

### FIGURE B — kosztorys „Suma prac wykonanych" = executed total, pre-rabat

- `src/components/kosztorys/use-kosztorys-editor.ts:285-287` —
  `subtotals = sectionSubtotalsForView(rows, stages, view)`, `totalNet = Σ subtotals.net`.
- Executed, not offered: each row's net uses `rowTotalQtyDone` = Σ over the stage columns
  (`src/lib/kosztorys/settlement.ts`) = Pomiar z natury (`=SUM(D:M)`), **not** Przedmiar `N`. The
  offered figure is the separate `plannedNet`, used only for the progress ratio. Confirms EX-489
  ("pomiar IS Σetapów").
- Rabat applied **after**: `doZaplatyNet = totalNet − globalDiscountAmount(...)`
  (`use-kosztorys-editor.ts:326-330`). The podsumowanie's „Robocizna" row is fed `doZaplatyNet`
  (post-rabat) (`kosztorys-totals-panel.tsx:101`), while „Suma prac wykonanych" is `totalNet`
  (pre-rabat) reconstructed as `robociznaNet + rabatAmount` (`kosztorys-podsumowanie.tsx:62`).

### THE BRIDGE — fully independent, by design

- `kosztorys-bridge/change.md:15,21` — "live join, no write-back, no sync"; write-back
  (auto-`LABOR_COST` from the rozpiska sum, rabat unification) is a "separate future change, decided
  after the read side is dogfooded."
- The kosztorys server action writes only to `kosztorys-items` / `kosztorys-sections` /
  `investments` metadata — never to `transactions` (`src/lib/actions/kosztorys.ts`).
- `sheets-sync.ts` syncs transfers **out** to Sheets; never writes a kosztorys total into a
  `LABOR_COST` transfer.

### CARDINALITY — one kosztorys per investment (DB-enforced 1:1)

- `src/collections/sheets.ts:10-11` — partial unique index on `investment_id`
  (`20260528_move_sheet_id_to_kosztoryses`). `getKosztorysTree(investmentId)` queries every child
  collection by `investment` (`src/lib/queries/kosztorys.ts:26-64`). One investment → exactly one
  item set. "Which kosztorys" is unambiguous.

### WHICH TOTAL — client view, persisted rows, executed, gross

- **Price view:** `PriceViewT = 'client' | 'w_tools' | 'own_tools'` (`src/lib/kosztorys/calc.ts:36`).
  The investor-facing price is **`client`** (`kosztorys-client-share/design.md:16-22` — subcontractor
  views must never leak; the client-safe figure is `clientPrice`). A derivation must **pin `client`
  explicitly**, not read the editor's active toggle (`use-kosztorys-editor.ts:287`).
- **Draft vs saved:** the displayed `totalNet` is a client-side `useMemo` over in-memory editor rows
  (display-only). A derived robocizna must be computed **server-side from persisted rows**
  (`kosztorys-items` + `kosztorys-stages` + `stage-progress`), reusing
  `sectionSubtotalsForView(persistedRows, stages, 'client')` alongside `deriveFinancials`.
- **Gross (owner constraint):** robocizna maps to the kosztorys **brutto** figure,
  `toGross(net, tree.vatRate)`. Client-at-netto is the `vatRate = 0` case (brutto ≡ netto) — one rule,
  no VAT special-casing.

### BLAST RADIUS — everything that reads robocizna

- **CALC:** marża = `totalLaborCosts − totalPayouts − totalRabat − totalLoss − totalSettled`
  (`src/lib/db/calculate-margin.ts:14`); bilans = income − (`totalMaterialCosts + totalLaborCosts`) +
  rabat (`src/lib/db/calculate-balance.ts:7`); listing "Koszty" = material + labor
  (`src/lib/queries/investments.ts:37`).
- **DISPLAY:** the „Robocizna" field is built in `src/lib/db/map-category-costs.ts:75-76` and rendered
  by `src/components/investments/financial-stats.tsx:17-18,88` (dashboard "Koszty"), the investment
  listing (`src/components/tables/investments.tsx:23`), the detail + raporty pages
  (`inwestycje/[id]/page.tsx:93`, `raporty/page.tsx:64`), and rides into export/PDF via
  `FinancialFieldT` (`src/types/export.ts:12`).
- **WRITE/EDIT (becomes dead if retired):** create via `expense-form.tsx` → `createBulkTransferAction`;
  edit amount via `edit-transfer-form.tsx` → `updateTransferAction` (LABOR_COST-only branch).
- **SHEETS (frozen):** `TRANSFERS_SUMMARY_TYPES` (`src/lib/constants/transfers.ts:117`) fixes
  `LABOR_COST` at summary slot 2; `sheet-summary.ts:27-46` writes a column-positioned SUMIF. Keep the
  slot as a 0-placeholder rather than delete it.

## Architecture Insights

- **The switch is a data-source swap, not a deletion.** `deriveFinancials` still needs a
  `totalLaborCosts` number; only its origin changes (kosztorys server-side sum vs Σ `LABOR_COST`
  rows). Every downstream consumer (marża, bilans, dashboard, export, sheets) keeps working
  unchanged if the number keeps arriving through `deriveFinancials`.
- **The one real modeling knot — pre- vs post-rabat.** If derived robocizna = the **post-rabat**
  kosztorys figure (`doZaplatyNet`), it double-counts the discount against margin's _separate_
  `totalRabat` bucket (`calculate-margin.ts:14`). If it = the **pre-rabat** `totalNet`, the existing
  `totalRabat` term keeps doing the netting — but then the kosztorys global-rabat and the transfer
  `RABAT` must be **unified** (the "rabat unification" the bridge notes name). This is the decision
  that has to be made before implementation; it is not mechanical.
- **FR-015:** the firewall forbids the kosztorys plane **writing** into transfers/balance/marża
  (`prd.md:229-232`; `collections/transfers.ts:155`). Deriving robocizna is the sanctioned crossing
  of that firewall — the deferred convergence, gated on an owner decision, not a free refactor.

## Code References

- `src/lib/db/investment-financials.ts:44` — the one line that defines robocizna today
- `src/lib/db/calculate-margin.ts:14` — marża formula (robocizna is the positive base)
- `src/lib/db/calculate-balance.ts:7` — bilans (totalCosts = material + labor)
- `src/components/kosztorys/use-kosztorys-editor.ts:285-330` — totalNet / doZaplatyNet
- `src/lib/kosztorys/settlement.ts` — `sectionSubtotalsForView` / `rowTotalQtyDone` (Σ etapów)
- `src/lib/queries/kosztorys.ts:26-64` — `getKosztorysTree(investmentId)` (persisted rows, 1:1)
- `src/lib/actions/transfers.ts:259-262` — LABOR_COST-only editable amount
- `src/hooks/transfers/recalculate-balances.ts:31-44` — cache bust only (cash-inert)
- `src/lib/constants/transfers.ts:117` — frozen `TRANSFERS_SUMMARY_TYPES` (LABOR_COST slot 2)
- `src/lib/google/sheet-summary.ts:27-46` — column-positioned SUMIF per summary type
- `src/lib/db/map-category-costs.ts:75-76`, `src/components/investments/financial-stats.tsx:17-88` — display

## Historical Context (from prior changes)

- `context/changes/kosztorys-bridge/change.md:21` — write-back explicitly deferred to a future change
- `context/changes/kosztorys-bridge/braindump.md:9-10,110-111` — bridge read-only; write-back parked P5
- `context/changes/kosztorys-client-share/design.md:16-22` — client price is the investor-safe figure;
  v2 has no marża field (disconnected from financials)
- Memory `project_kosztorys_equals_robocizna_disconnected` — owner ruling: kosztorys IS robocizna;
  v2 disconnected from marża; the link is parked P5, don't re-litigate

## Decided model (owner, 2026-07-19) — read-only, symmetric, NOT a write-back

Corrected framing: this is a **pure read**, not a write-back, and does **not** cross FR-015 (a write
firewall — reading a kosztorys sum into a render-time calc mutates nothing). Marża/bilans are already
computed on read; only the _source_ of two inputs changes.

Both "no source register" billing figures — the two transfer types that only ever existed to carry a
number, never a cash movement — stop being transactions and are **read from the one kosztorys**:

| Margin term                   | Today                            | After                                                                                  |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| robocizna (`totalLaborCosts`) | Σ `LABOR_COST` transfers (typed) | read kosztorys „Suma prac wykonanych" — Σetapów, client view, **gross**, **pre-rabat** |
| rabat (`totalRabat`)          | Σ `RABAT` transfers (typed)      | read the kosztorys unified rabat (global-or-Σper-item), gross                          |
| wypłaty / strata / materiały  | transactions                     | **unchanged — real cash, stay transactions**                                           |

`marża = robocizna − wypłaty − rabat − strata` and `bilans = income − (materiały + robocizna) + rabat`
still hold; robocizna and rabat now both come from the kosztorys. The pre/post-rabat double-count knot
**dissolves** — there is one rabat figure (the kosztorys one) feeding the one `totalRabat` term.

Value rule: gross via `toGross(net, tree.vatRate)`; client-billed-at-netto is the `vatRate = 0` case.

## Open Questions (remaining)

1. **Where the read runs** — inside `deriveFinancials` (all consumers inherit it) vs a dedicated
   server join in `sum-transfers.ts`. Leaning `deriveFinancials`.
2. **Listing perf** — the detail page already loads the kosztorys tree (free); the investment listing
   aggregates every investment through `deriveFinancials`, and the client-view-net total lives in TS
   settlement over up to 1000+ rows/investment. Load N trees on the listing, or replicate the
   client-view-net formula in SQL? This is the real engineering cost.
3. **Existing `LABOR_COST` / `RABAT` rows on live investments** — kosztorys rows are throwaway until
   dogfooding merges to `main`, but these transfers on real investments are not kosztorys data. Do
   they get ignored (source flips), or removed? An investment with no kosztorys rows would then read
   robocizna = 0.
4. **Sheets** — the frozen SUMIF „Koszty robocizny" (and rabat) columns go to 0 once those transfers
   stop being entered. Leave the slots as 0-placeholders (frozen-contract lesson) — only affects
   FR-014 legacy-mirrored investments.
5. **Fixed-price job with no kosztorys** — is there a case that still needs a manual robocizna/rabat
   override, or is "no kosztorys → 0" acceptable?
