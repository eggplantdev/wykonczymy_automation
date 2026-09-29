---
change_id: ex-555-write-switch-labor-rabat
title: Labor + discount from the kosztorys on the investments listing; LABOR_COST and RABAT leave the form
status: archived
created: 2026-08-12
updated: 2026-08-12
archived_at: 2026-08-12
branch: konradantonik/ex-672-remove-print-csv-export
worktree: null
---

## Notes

EX-555, widened on 2026-08-12 from the discount alone to the whole write-switch (`RABAT` +
`LABOR_COST`).

> **Superseded (EX-649):** the write-switch half is reversed — `LABOR_COST` and `RABAT` are bookable
> again for every investment until EX-712 (AGENTS.md § Transfer Business Logic). The read-switch
> (labor and discount from the kosztorys, no fallback) stands.

### Problem

The read-switch existed on one plane only: the v2 Podsumowanie read labor and discount from the
kosztorys, while the investments listing read everything from one `GROUP BY` over `transactions`.
The same investment showed a different balance on the listing than in its own Podsumowanie.

### Owner rulings (2026-08-12)

1. **Both types in one change.** `clientTotalsFromSubtotals` returns labor and discount from one
   pass; switching the discount alone would give a balance that is a hybrid of two planes, still out
   of line with the Podsumowanie.
2. **Old transactions stay as legacy.** Enum, rows, history untouched; zero backfill. Legacy rows
   still render, cancel and sync to the sheet.
3. **Hidden from the form only**, via `TRANSACTION_TRANSFER_TYPES` — a list separate from the Payload
   enum, labels, colours and sheet lists.
4. **No fallback.** An initial "no kosztorys rows → transactions" fallback was **revoked** after the
   owner saw investment 31 (empty kosztorys, v2 showing 235 911 zł from transactions). There is one
   right source and no figure declares its own; an empty kosztorys is **0 zł**. 84 of 96 investments
   dropped to zero on the listing, as intended — that gap is the to-do list, not a defect.
5. **v1 is a source choice, not legacy to retire.** It reads the transactions plane, which is where
   old labor stays visible until it is entered into the kosztorys.

### Design choices (after research)

- **Aggregate in SQL (option B)** — `kosztorys-client-totals.ts`, guarded by a SQL↔TS parity test.
  Rejected:
  - **A (load the trees on the listing):** 3 491 rows / 12 investments then, ~30k expected, per page load.
  - **C (materialize on kosztorys save):** anti-precedent in `20260222_drop_materialized_columns.ts`,
    and no write chokepoint — 5 raw SQL writes bypass hooks, the Payload panel bypasses actions.
  - **D (batch read of rows):** measured on a synthetic 1000 investments × 300 items × 3 stages —
    200 investments = 240k rows / 10 MB per cache expiry; 1000 = 1.2M rows / 49 MB and ~200 MB heap
    to compute two numbers per investment. The aggregate returns one row per investment.
  - Research first rejected B by costing the whole `sectionSubtotalsForView`; for these two figures
    the path filters no stages and doesn't round, so it is a `SUM` plus one three-branch `CASE`.
- **Seam in `shapeInvestments`, not `deriveFinancials`** — a seam in the figure factory would have
  switched v1 too.
- **v2 margin also from the kosztorys**, fed the same reading the panel already computes.
- **Write-switch escape hatches:** the Payload panel and `z.enum(TRANSFER_TYPES)` in actions were
  accepted (as in EX-557); the sessionStorage expense draft was fixed, being the only one an ordinary
  user hits.
- **Deposits unchanged.** The listing's `'income'` bucket and the panel's `INVESTOR_DEPOSIT` filter
  differ formally but were identical on prod data (no `COMPANY_FUNDING` with an investment, every
  `OTHER_DEPOSIT` with one cancelled).

### Accepted consequence

Margin and balance start reacting to the kosztorys discount — the kosztorys↔margin link deferred
since 2026-07-16, made here on purpose. Both calculators read the same two `InvestmentFinancialsT`
fields, so splitting balance from margin would have been extra, unwanted work.

### Found in passing

- **Discounts booked as the wrong type** (2774 as a correction; 1196 as „Inna wpłata", cancelled):
  with the kosztorys discount now in margin and balance, a discount disguised as a correction is a
  double-count candidate.
- **Uncategorised corrections** (ten rows, Σ −2 087,70 zł) are counted correctly by
  `uncategorisedRemainder`; only the row label is wrong — a data fix for the owner. The remainder
  code stays: it guards Σ rows === materials total.

### Legacy scale (local prod copy, 2026-08-12)

`LABOR_COST` 78 rows, Σ 3 312 680,30 zł · `RABAT` 11 rows, Σ 106 622,69 zł · 60 of 96 investments
carry them, 7 of those have kosztorys rows.
