---
date: 2026-09-29T08:28:54+02:00
researcher: Claude (Opus 5.5)
git_commit: 51cb5253438ef427b3f4aee1ff656ba388503491
branch: staging
repository: wykonczymy
topic: "Show the kosztorys „Pozostało do wypłaty" per investment on the investments listing"
tags: [research, codebase, investments-listing, kosztorys, subcontractor-summary, payouts]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: „Pozostało do wypłaty" on the investments listing

**Date**: 2026-09-29T08:28:54+02:00
**Git Commit**: 51cb5253 · **Branch**: staging · **Repository**: wykonczymy

## Research Question

The owner wants the investment-level „Pozostało do wypłaty" from the kosztorys summary
(Podsumowanie → Podwykonawcy, e.g. 15 710,20 − 3 738,19 = 11 972,01) as a column on the investments
listing, to scan where crews are still owed money. Where is the figure computed, and how does it
reach the listing?

## Summary

**Both inputs are already on the listing row path, computed per investment in bulk. The column is
one subtraction in `shapeInvestments`: no new SQL, no new cache entry, no key bump.**

- Należne („Suma wykonanej pracy") = `selectKosztorysSubcontractorDue` → `subcontractorDueRecord[id].due`,
  already fetched for Marża v2 and pinned to the editor's TS calc by a DB parity spec.
- Zaliczki („Zaliczki (wypłaty)") = `financials.totalPayouts`, already rendered as the „Wypłaty" column.
- The panel's figure: `computeSubcontractorSummary` → `remaining = roundToCents(dueNet − payoutsTotal)`
  (`src/lib/kosztorys/subcontractor-summary.ts:135`). The listing equivalent is
  `roundToCents(due − totalPayouts)`.

Four design decisions remain (see Open Questions): what an unconfirmed plane does to the figure, what
an investment without a kosztorys shows, the role gate, and v2-switch membership.

## Detailed Findings

### The figure in the editor (the spec)

- The tab is at `src/components/kosztorys/summary/summary-panel-content.tsx:43` and `:266-275`. The
  wrapper `blocks/subcontractor-summary.tsx:47-52` calls
  `computeSubcontractorSummary(subcontractorDue.combined, derivePayoutsByWorker(payoutTransactions, workers), {byWorker, stages, workers})`.
- **Należne** = `subcontractorDueByPlane(rows, stages)` (`src/lib/kosztorys/subcontractor-due.ts:53-83`).
  It runs client-side (`use-kosztorys-editor.ts:388`), so it reacts to unsaved edits. For each etap it
  sums `qty_done × subcontractorPrice(row, etap.plane)`.
  - The price is chosen in this order: the item's own coefficient, else the item's fixed amount, else
    `clientPrice × the investment coefficient` (`calc.ts:184-193`).
  - The coefficients live on `investments.w_tools_coeff` / `own_tools_coeff`, with defaults 0.65 /
    0.5525 (`constants.ts:29`).
  - No rabat is applied; the figure is pre-rabat on purpose (`subcontractor-due.ts:44-47`).
  - An etap with `plane = null` is skipped and sets `hasUnconfirmedPlane`.
- **Zaliczki** = transactions with `type = 'PAYOUT' AND investment_id = $1 AND cancelled IS NOT TRUE`
  (`src/lib/db/get-payout-transactions.ts:19-26`). They arrive as a server prop through
  `fetchPayoutTransactionsForInvestment` (cached under `transfers`).
  - Payouts with no worker are included.
  - There is no netto/brutto split: crews are paid without VAT (EX-558).
- **Pozostało** is not clamped. A negative value renders red (`subcontractor-headline-summary.tsx:66-71`).
- **An unconfirmed plane does not hide the figure in the panel.** The panel prints the short należne
  with a `planeUnconfirmed` hint on the „Suma wykonanej pracy" label (`:49-58`). „Pozostało" itself
  carries no hint.

### Listing data path

- **Page:** `src/app/(frontend)/inwestycje/page.tsx:12-15`, gated to `MANAGEMENT_ROLES`, calls
  `fetchAllInvestments()`.
- **Query:** `src/lib/queries/investments.ts:21-38` runs 5 cached bulk fetches in parallel, then
  `shapeInvestments` (`src/lib/queries/shape-investments.ts:24`). That function is pure, deliberately,
  so the parity specs run the real row builder.
- **Należne on the row path:** `fetchKosztorysSubcontractorDue` (`src/lib/queries/balances.ts:131-136`,
  key `kosztorys-subcontractor-due-v1`, tags `KOSZTORYS_CLIENT_TOTALS_TAGS`) returns
  `{ due, hasUnconfirmedPlane }` per investment. Today its only consumer is
  `marginV2(financials, subcontractorDueRecord[id] ?? NOTHING_DUE)` (`shape-investments.ts:99-100`).
- **Zaliczki on the row path:** `totalPayouts = sumBucket(rows, 'payouts')`
  (`src/lib/db/investment-financials.ts:110`), from `sumAllInvestmentFinancials`
  (`sum-transfers.ts:136`, which excludes cancelled rows). It is exposed as `row.totalPayouts`
  (`shape-investments.ts:75`). It is the same row set as the panel's query.
- **Row type:** `InvestmentRowT` in `src/types/table-rows.ts:12`.
- **Columns:** `src/components/tables/investments.tsx`.
  - „Marża v2" (`:167-186`) is the closest cell precedent: `sortUndefined: 'last'`, „brak danych" via
    `hasKosztorysReading`, and „ustaw etapy" when withheld.
  - „Wypłaty" (`:241-252`) sits behind `isAdminOrOwner`.
  - `V2_COLUMN_IDS` (`:27-32`) drives the „Kolumny v2" switch.
  - Header tooltips live in `INVESTMENT_HEADER_TIPS`.
- **Invalidation is already right.** A transfer write expires `transfers`, which carries
  `totalPayouts`. A kosztorys edit expires the kosztorys tags, which carry the należne.

### Tests the column joins

- `src/__tests__/lib/queries/shape-investments.test.ts`: add a describe next to „marża v2" (`:471-542`).
- `src/__tests__/investment-render-parity-db.test.ts`: listing vs editor on real data. It already
  compares due against `subcontractorDueByPlane`; this change adds a comparison against
  `computeSubcontractorSummary(...).remaining`.
- `src/__tests__/financial-golden-master-db.test.ts`: the snapshot stores `totalPayouts` and
  `marginV2`. Adding the field to it means regenerating the fixture (`pnpm test:golden:update`).
  Optional, because the field is derived from two figures the snapshot already pins.
- `kosztorys-subcontractor-due.test.ts` (SQL↔TS) and `balances-cache-tags.test.ts` are untouched
  unless the SQL or the tags change.

## Code References

- `src/lib/kosztorys/subcontractor-summary.ts:84-136` — `computeSubcontractorSummary`, the panel's headline
- `src/lib/kosztorys/subcontractor-due.ts:53-83` — `subcontractorDueByPlane` (TS należne)
- `src/lib/db/kosztorys-subcontractor-due.ts:26-81` — `selectKosztorysSubcontractorDue` (SQL twin)
- `src/lib/kosztorys/margin-v2.ts` — `marginV2`, returns `null` on `hasUnconfirmedPlane`
- `src/lib/queries/shape-investments.ts:24-120` — listing row assembly, the insertion point
- `src/components/tables/investments.tsx:27-32, 160-252` — v2 ids, Marża v2 cell, Wypłaty gate
- `src/components/kosztorys/summary/blocks/subcontractor-headline-summary.tsx:49-71` — panel rendering
- `src/lib/db/get-payout-transactions.ts:19-26` — panel's payout query
- `src/lib/db/investment-financials.ts:110` — listing's `totalPayouts`

## Architecture Insights

- **One definition, two carriers.** Należne has a TS function (editor, live) and an SQL twin (listing,
  bulk), and a DB parity spec pins them together. The new column must reuse that twin and must not
  grow a third formula. The listing already follows this pattern: its v2 bilans is described as „the
  panel's figure, negated — the same call" (`shape-investments.ts:47-50`).
- **Source per figure** (`lessons.md:423`): należne is live in the editor but committed state on the
  listing. That is fine, because the listing reads saved data.
- **Rounding:** the panel sums per-worker payouts after rounding each worker's total to the grosz,
  then rounds the difference once. The listing's `totalPayouts` is a raw SUM. The two can differ by
  ≤1 gr only if amounts carry sub-grosz precision; stored kwoty are to the grosz, so in practice they
  agree exactly.
- **No cache key bump.** No cached payload changes shape; the new field lives only on
  `InvestmentRowT`, which is built after the caches (`lessons.md:1056`).

## Historical Context (from prior changes)

- `context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md` (EX-554) — defines the three
  figures. Zaliczki = PAYOUT scoped to the investment; payouts without an investment (~5%) are
  excluded on purpose. There is one netto „Kwota", no VAT.
- `context/archive/2026-07-23-etap-tool-plane/` (EX-565) — plane per etap. The mixed reading is the
  only one where „należne − wypłaty = pozostało" holds (domain notes `:922-925`).
- `context/archive/2026-07-25-subcontractor-view-settlement-only/` (EX-570) — an etap without a plane
  counts in neither figure. A badge is the only signal.
- `context/archive/2026-07-27-kosztorys-stage-worker-assignment/` (EX-613) — one worker per etap.
  Unassigned etapy go to a leftover bucket. A negative pozostało is always red. One pure function
  feeds both the editor and the DB. The panel is not role-gated.
- `context/archive/2026-08-18-marza-prognoza-rzeczywista/` — introduced the SQL fold for the listing,
  because full trees were ~10 MB per 200 investments. A plane-less etap withholds Marża v2 („ustaw
  etapy") on the listing. The overpayment wording is still open: „Nadpłata" / „nadpłacone" /
  „Wypłacono więcej niż wykonano" (`review-gate.md:130-131`). The Wypłaty/Marża gates versus the
  ungated Robocizna columns were left for the owner (`:127-129`).
- `context/changes/2026-09-03-worker-payouts-on-employee-card/change.md` — status `new`, nothing
  built. Planned direction: add `worker_id` to the same SQL fold's `GROUP BY`. That is the per-worker
  sibling of this per-investment figure. If part 2 of this feature is that change, the two share the
  fold.

## Related Research

- `context/archive/2026-08-18-marza-prognoza-rzeczywista/research.md` — the listing SQL-fold rationale
- `context/archive/2026-08-11-investments-listing-expense-plane/` — listing column plane rules

## Open Questions

1. **Unconfirmed plane.** Marża v2 withholds and shows „ustaw etapy"; the panel shows the short
   figure with a hint. The listing column could withhold like Marża v2, or show the number with a
   hint icon. A short należne understates what is owed, so the figure reads *too optimistic*, and
   that is the dangerous direction for a „where do I still owe" scan.
2. **No kosztorys.** It could show „brak danych" (as the other v2 columns do) or `−Σ wypłat`. The code
   comment on Marża v2 argues that no kosztorys means nothing is owed, which makes zero a fact. But
   then pozostało = −wypłaty, and every legacy investment reads as overpaid.
3. **Role gate.** The figure reveals Σ wypłat (należne − pozostało) and the crew cost, which the
   listing hides from MANAGER („Wypłaty" and „Marża" are `isAdminOrOwner`). The panel itself is
   ungated. Default: gate it like Wypłaty.
4. **v2 switch.** Should the column join `V2_COLUMN_IDS`? It is kosztorys-sourced and has no v1 twin.
5. **Negative value.** Should it be red like the panel, and with which label: „Nadpłata" or
   „Wypłacono więcej niż wykonano"?
