---
date: 2026-10-11T20:07:30+02:00
researcher: Claude (Opus 5.5)
git_commit: d8f7904547d4fab0ef574d554b2d09b88a67b3f0
branch: invoice-download-date-range
repository: wykonczymy
topic: 'Raporty page — restore-and-patch (EX-598) or rebuild on the current financial model?'
tags: [research, raporty, financials, v1-v2, kosztorys, marza, bilans, EX-598, EX-678, EX-712]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
---

# Research: Raporty page — restore or rebuild?

## Research Question

The way robocizna, rabat, strata and premia are counted has changed (kosztorys as the source of
robocizna/rabat, v1 vs v2, strata, premia). Does `/raporty` still make sense, and is rebuilding it from
scratch better than patching it?

## Summary

**Do not restore it. EX-598's restore-and-patch plan is obsolete.** Four findings:

1. **The page is already off.** Since 2026-08-19 (`52b1f3d87`) `/raporty` renders only „W budowie”
   and has no menu entry (`src/app/(frontend)/raporty/page.tsx:8-15`). There is nothing live to patch.
2. **The old page is a pure v1 aggregate.** It ran `deriveFinancials` once over every filtered transfer
   in the system. Robocizna = Σ `LABOR_COST` and rabat = Σ `RABAT` (the plane EX-712 retires), there is
   no netto concession (the rate is per investment), and premia is not in the marża. It also mixes
   company-level rows into investor figures:
   - `COMPANY_FUNDING` and `OTHER_DEPOSIT` count as „wpłaty”;
   - payouts with no investment lower the marża;
   - `OTHER` overheads are not counted at all.

   Restored verbatim it would not compile either: `deriveFinancials` moved, and `TransferQueryT` now
   requires `sort`.

3. **The table half duplicates the Pulpit.** The dashboard (`manager-dashboard.tsx:60-87`) has the
   same company-wide transfers table with the same URL filters, audit mode and Suma tile. It lacks only
   „Faktury” (invoice download), print, and the inactive investments in the filter lists.
4. **The correct primitive already exists.** Every financial figure is linear **per investment** once
   that investment's own rate, VAT and mode are applied. So a company figure is **Σ over the listing
   rows** (`shapeInvestments`), never one pooled `deriveFinancials`. Pooling is exactly what loses the
   per-investment concession.

**The open question is not technical; it is what question the report answers.** No owner statement
about it exists anywhere (Linear EX-598/678/712 have no comments; no PRD requirement, no roadmap
slice, no company summary in the owner's sheet). The page originated as „the investment card's v1
tiles, summed over any filtered slice of transfers” (`4e287144a`, 2026-03-08). That shape cannot
survive v2, because **v2 robocizna has no time axis**: `stage_progress.qty_done` is a current-state
cell that gets overwritten, with no history
(`src/migrations/20260709_0_add_kosztorys_stages.ts:23-30`). „Marża za wrzesień” on v2 cannot be
computed from the data. Only cash movements (transfers) can be cut by date.

## Detailed Findings

### What the old page was

- **History:**
  - created as `/transakcje` „report page with filtered stats” on 2026-03-08 (`4e287144a`), renamed
    `/raporty` the same day (`19bcd407a`), ADMIN/OWNER only;
  - pie chart added (`d50871464`), later removed with recharts (`7ac09b20e`, `d00e33809`);
  - Rabat, Strata and settled tiles arrived only as side effects of the investment-page specs (see
    Historical Context).
- **Pre-disable source:** `git show 52b1f3d87^:"src/app/(frontend)/raporty/page.tsx"`:
  - `fetchFilteredByType` + `fetchCategoryBreakdowns` under `stripCancelledFilters(urlFilters)`;
  - `deriveFinancials(…, undefined, undefined, netCategoryCosts)`, i.e. no rate and no mode;
  - `FinancialStats` + `calculateMargin`;
  - a `TransfersSection` with `invoiceDownload` and `cancelledTransactionAudit`.

### What each figure would show if restored today

`sumFilteredByType` has no `investment_id IS NOT NULL` filter (`src/lib/db/sum-transfers.ts:263-275`),
so every transfer row lands in some figure.

| Figure                      | Today                                                                | Why it is wrong under the current model                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Robocizna / Rabat           | Σ `LABOR_COST` / Σ `RABAT`                                           | v1 plane only. Work entered only in a kosztorys is 0, so the figure under-reports exactly the investments that moved to v2. There is no v2 aggregate at all.                                                      |
| Wpłaty („Bilans inwestora”) | Bucket `income` = INVESTOR_DEPOSIT + OTHER_DEPOSIT + COMPANY_FUNDING | Owner capital injections are counted as investor money (`lessons.md:1240-1242` records this as intended for `/raporty`, but the label lies). GROSS deposits are counted at `amount`, and `net_amount` is ignored. |
| Materiały                   | Includes CORRECTION with no investment                               | `transfers.ts:544-556` (investment optional).                                                                                                                                                                     |
| Materials-netto concession  | 0                                                                    | No single rate exists across investments (`investment-financials.ts:76-84`): marża too high, bilans too low. This is the original EX-598 bug.                                                                     |
| Strata                      | Handled                                                              | `calculate-margin.ts:20`, `calculate-balance.ts:19`.                                                                                                                                                              |
| Premia (BONUS)              | Computed, never shown                                                | Absent from v1 marża by design (`margin-v2.ts:19-21`).                                                                                                                                                            |
| Marża                       | LABOR_COST − **all** PAYOUTs − rabat − strata − settled              | Payouts with no investment (salaries, loans, fuel) lower it. Overheads (`OTHER`) never enter it. Neither is a v1 or a v2 marża.                                                                                   |
| Cancellations               | Correct                                                              | `cancelled IS NOT TRUE` is hardcoded (`sum-transfers.ts:271`). The newer pages use `statsWhereFrom` (`transfer-filters.ts:293`).                                                                                  |

### The current per-investment model (what a rebuild must sum)

- **Listing pipeline:** `fetchAllInvestments` (`src/lib/queries/investments.ts:23-43`) runs six bulk
  reads and feeds them to `shapeInvestments` (`src/lib/queries/shape-investments.ts:24-121`).
  - Transactions plane: `sumAllInvestmentFinancials` (`sum-transfers.ts:108-212`). One GROUP BY,
    joined with each investment's `materials_net_rate` and `settlement_mode`, then `deriveFinancials`
    per investment.
  - Kosztorys plane: `selectKosztorysClientTotals` (`src/lib/db/kosztorys-client-totals.ts:38-109`)
    gives robocizna and rabat per investment, swapped in by `financialsOnReading`
    (`src/lib/kosztorys/summary-reading.ts:33-60`).
- **Bilans v2:** `−computeAmountDue(…).net|.gross` (`src/lib/kosztorys/summary-economics.ts:84-102`).
  - net = `(robocizna − rabat) + billedMaterials − paid.net − loss`;
  - gross = robocizna grossed by VAT.
  - Deposits are INVESTOR_DEPOSIT only, split by plane (`src/lib/db/deposit-plane-sums.ts:18-48`).
- **Marża v2:** `robocizna − rabat − due − settled − loss − bonus` (`src/lib/kosztorys/margin-v2.ts:32-45`).
  It is `null` when a stage with executed work has no settlement plane.
- **„Pozostało do wypłaty”:** `due + bonus − payouts` (`margin-v2.ts:53-58`). It is undefined when
  there is no kosztorys.

**Additivity (Σ over listing rows vs pooled):**

- **Σ is correct for:** materiały, deposits, payouts, robocizna v1/v2, rabat, strata, premia, settled,
  marża v1 and bilans v1. Each term is computed per investment, and there are no clamps
  (`summary-economics.ts:76-77` allows negatives on purpose).
- **Rules a Σ must respect:**
  - **Per-investment rate and GROSS gate:** pooled = wrong; Σ = right.
  - **Per-investment VAT:** Σ gross per investment, never Σ net × one VAT.
  - **Plane by mode:** NET/MIXED bilans is netto and GROSS bilans is brutto. Adding the two mixes
    planes, so a total needs two columns (Σ netto over NET/MIXED, Σ brutto over GROSS) or one plane
    chosen explicitly.
  - **`null` marża v2 / undefined „Pozostało”:** skip and count („bez 3 inwestycji, brak etapu”), or
    withhold the total.
  - **Rounding:** `roundToCents` runs per investment, so expect grosz-level drift against an unrounded Σ.
  - **Trashed investments:** split off in `reference-data.ts:144`, so they drop out of a listing Σ.

### Company-level figures (invisible to a Σ over investments)

Allow/require sets are in `src/lib/constants/transfers.ts:531-556`, enforced in
`src/hooks/transfers/validate.ts:148-158`.

| Category                      | Types                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Never linked to an investment | `COMPANY_FUNDING`, `OTHER_DEPOSIT`, `OTHER` (overheads), `REGISTER_TRANSFER`, `CANCELLATION`                                                                                                                                                                                                          |
| Optionally linked             | `PAYOUT` (salaries, loans, fuel; also premia booked without an investment), `CORRECTION`                                                                                                                                                                                                              |
| Already shown elsewhere       | Register balances: Pulpit „Saldo wszystkich kas” (`user-register-stats.tsx:43`), `/kasy` with a balance chart (`cash-registers-table.tsx:77`), all summed by `sumAllRegisterBalances` (`sum-transfers.ts:61-102`). Overheads per category can be reached on the Pulpit by filtering type + Suma tile. |

### The transfers table

`/` → `manager-dashboard.tsx:60-87` already provides the old report's table: same
`buildTransferFilters`, `sort`, audit mode, Suma tile. It differs from the old report in three ways:

- no `invoiceDownload` (ZIP of invoices) and no `print`;
- narrower filter lists (visible registers, active investments, management users);
- MANAGER also sees it.

`e2e/transfer-sum-tile.spec.ts:17-21` already moved the EX-574 regression off `/raporty`.

## Code References

- `src/app/(frontend)/raporty/page.tsx:8-29` — „W budowie” stub
- `src/app/(frontend)/raporty/loading.tsx:5`, `src/lib/constants/sections.ts:38` — the page's leftovers
- `src/lib/db/investment-financials.ts:76-119` — `deriveFinancials` (moved out of `sum-transfers`)
- `src/lib/db/calculate-margin.ts:16-22` / `calculate-balance.ts:12-21` — v1 formulas
- `src/lib/db/sum-transfers.ts:108-212` — per-investment bulk transactions plane
- `src/lib/db/sum-transfers.ts:263-275` — pooled `sumFilteredByType` (no investment filter)
- `src/lib/queries/shape-investments.ts:24-121` — per-investment v1 + v2 row, the Σ primitive
- `src/lib/db/kosztorys-client-totals.ts:38-109` — kosztorys robocizna/rabat per investment
- `src/lib/kosztorys/summary-economics.ts:84-102` — `computeAmountDue` (bilans v2)
- `src/lib/kosztorys/margin-v2.ts:32-58` — marża v2, „Pozostało do wypłaty”
- `src/lib/constants/transfers.ts:92-257, 531-556` — buckets; investment allow/require sets
- `src/components/dashboard/manager-dashboard.tsx:60-87` — company-wide transfers table (Pulpit)
- `src/app/(frontend)/inwestycje/page.tsx` — listing: no totals row, client-side filters only
- `src/migrations/20260709_0_add_kosztorys_stages.ts:23-30` — `stage_progress.qty_done` has no history

## Architecture Insights

- **One concept, many surfaces, one source.** `lessons.md:21` already records the bilans/marża drift
  between the listing, the investment page and the old report (three code paths for one figure). A
  rebuilt report must **read** `shapeInvestments` rows, not compute its own figures. That is the same
  rule as „derive the figure from the rows in the component” (`lessons.md` ~1225).
- **Pooled aggregation is the anti-pattern here.** Each figure has a per-entity parameter (netto rate,
  VAT, settlement mode), so the aggregate must be a fold over per-entity results (map, then reduce),
  never one formula over pooled inputs. In SQL terms: `GROUP BY investment_id` first, then sum. Never
  apply the formula to a global `GROUP BY type`.
- **Time vs state.** Transfers are an event log (cuttable by date). The kosztorys is current state (no
  date axis). Any „okres” filter therefore applies only to the cash plane. A v2 report is a snapshot
  („stan na dziś”), not a period P&L.

## Historical Context (from prior changes)

- `context/archive/2026-07-26-materials-net-pricing-persisted/change.md:54-58` — the page „is knowingly
  wrong and says so”, because the per-investment concession cannot be applied to a pooled aggregate.
- `context/archive/2026-07-28-cancellation-sum-overcount/change.md:30-38` — owner sent the `/raporty`
  E2E to `e2e-backlog`. `context/foundation/manual-checks.md:31, 49-51, 63-66, 77-110` still holds eight
  EX-574 boxes blocked on EX-598.
- `context/reference/superpowers/archive/2026-06-11-investment-rabat.md:672`, `…loss-strata…:391`,
  `…settled-internal-material.md:538` — tiles reached the report only because it shared
  `FinancialStats`.
- Linear:
  - **EX-598** — restore-from-git plan. Its definition of done: the page returns to the menu, and its
    marża and bilans equal the sum of the investment cards.
  - **EX-678** — the owner left `/raporty` out of EX-555 (2026-08-12). The premise was re-checked
    2026-09-22, and the issue was made a sub-issue of **EX-712**.
  - **EX-712** — calls `/raporty` „the fourth v1 surface” and asks „czy raporty zostają jak są, czy
    dostają własny, węższy builder”.
- Stale docs that still say v1 marża „stays live on v1, `/raporty`”:
  `context/foundation/investment-financials-and-discount.md:132, 269` and
  `context/domain/01-domain-distillation.md:130`.

## Related Research

- `context/changes/2026-10-11-investment-transactions-page/research.md` — `/inwestycje/[id]` as the
  per-investment transactions page (same day).

## Options

|       | Option                                                     | What it is                                                                                                                                                                                                                                                                                          | Cost                         | Answers                                                 |
| ----- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| **A** | Delete `/raporty`; add a Σ row to the investments listing  | One totals footer over `shapeInvestments` rows (respecting plane-by-mode and `null` counts), following the listing's client-side filters. Move „Faktury” to the Pulpit table if anyone needs it. Delete the stub, `loading.tsx` and `PAGE_TITLES.reports`, and close EX-598 / EX-678 as superseded. | Small                        | „How do my investments stand in total, today?”          |
| **B** | Rebuild `/raporty` as a narrow v2 snapshot + company block | Section 1: Σ of listing rows over a chosen set of investments (status, client), as a snapshot. Section 2: company-level cash for a date range (funding, overheads by category, payouts without an investment), read from the transfers plane, where dates are real.                                 | Medium                       | „How is the company doing — investments and overheads?” |
| **C** | Restore + patch (EX-598)                                   | Restore from git, compute the concession per investment under the URL filter.                                                                                                                                                                                                                       | Medium, and dies with EX-712 | v1 only; rejected                                       |

**Recommendation: A, unless the owner names a question only B answers.** A reuses the one source the
listing and the cards already agree on, adds no new aggregation code, and removes a v1 surface ahead of
EX-712. B is A's Σ plus a company block, so A is not wasted if B comes later.

## Open Questions

1. **For the owner:** what does he want to read off a company-level report? Two candidates:
   - „stan wszystkich inwestycji łącznie na dziś” → A;
   - „wynik firmy za okres, z kosztami ogólnymi” → B, and only the cash half can be cut by period.

   No record answers this.

2. Does anyone use „Faktury” (the invoice ZIP) across investments? It existed only on `/raporty`; the
   Pulpit table lacks it.
3. Totals over mixed settlement modes: two Σ columns (netto / brutto), or one total per plane with a
   count of the investments it covers?
4. Not checked against the DB: legacy `COMPANY_FUNDING` / `OTHER_DEPOSIT` rows linked to an investment
   from before EX-557. They would still count in v1 income.
