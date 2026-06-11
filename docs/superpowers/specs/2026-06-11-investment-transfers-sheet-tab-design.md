# Investment "Transfery" Sheet Tab — Design

**Date:** 2026-06-11
**Status:** Approved, ready for planning
**Scope:** Temporary overview tab. Add a second app-managed tab to each linked investment sheet that mirrors all investment-linked transfer types except `INVESTMENT_EXPENSE` (which already has its own tab).

## Problem

Today each linked kosztorys sheet has exactly one app-managed tab,
`'wydatki inwestycyjne (tylko do odczytu)'`, mirroring `INVESTMENT_EXPENSE`
transactions for one investment (`src/lib/actions/sheets-sync.ts`,
`src/lib/google/sheets.ts`). The other investment-linked transfer types are not
mirrored anywhere in the sheet. We want a single "grab-all" tab covering them so
the owner can see the rest of an investment's transfers and their per-type totals
without leaving the sheet.

The sheet primitives are currently hardcoded to one tab and one 7-field row
schema (`MATERIALY_TAB` / `TAB_RANGE` / `MATERIALY_HEADER` / `FIELD_MATCHERS` are
module constants in `sheets.ts`). Adding a tab requires generalizing those
primitives, not just adding a constant.

## Scope

### In scope

A new app-managed, read-only tab `'transfery (tylko do odczytu)'` on the same
linked sheet, mirroring these **six** investment-linked transfer types (the
canonical list lives in `src/collections/transfers.ts` — `showInvestment`
predicate; verify there, do not trust this copy):

- `INVESTOR_DEPOSIT` (Wpłata od inwestora)
- `LABOR_COST` (Koszty robocizny)
- `RABAT` (Rabat)
- `PAYOUT` (Wypłata)
- `CORRECTION` (Korekta) — amount may be negative
- `LOSS` (Strata) — investment optional; only LOSS rows that _have_ an investment appear

`INVESTMENT_EXPENSE` is **excluded** (it owns the existing expenses tab — no row
duplication across tabs).

### Out of scope

- `CANCELLATION` rows are never rendered (no `investment` field; not in the six).
- Non-investment-linked types (`COMPANY_FUNDING`, `OTHER_DEPOSIT`,
  `REGISTER_TRANSFER`, `OTHER`).
- Any change to the expenses tab's data, layout, or behavior. Byte-identical
  output is a hard requirement (see Test Plan, criterion 1).

## Cancellation semantics

Identical to the expenses tab. The mirror reflects **active** transfers only:

- Desired row set = `type ∈ {six} AND cancelled != true`, scoped to the
  investment.
- The reconciler removes any sheet row whose `id` is no longer in that set
  (orphan removal), scoped to this investment's own transfers of these types
  (same id-collision guard as `buildSyncPlan`, `sheets-sync.ts:157`).
- When a `CANCELLATION` row is created, the single-transfer sync resolves its
  `cancelledTransaction`, and if that original is one of the six types, removes
  the original's row from the transfers tab (mirrors the expenses-tab path at
  `sheets-sync.ts:264`).
- A transfer carrying `cancelled: true` has its row dropped.

## Tab layout

**Tab name:** `'transfery (tylko do odczytu)'`
**Protection:** entire tab read-only, service-account-only editor — same
`addProtectedRange` strategy as the expenses tab (`sheets.ts` setup).

**Columns (8):**

| Col | Header (`pl`) | Source                                 | Notes                                      |
| --- | ------------- | -------------------------------------- | ------------------------------------------ |
| A   | `id`          | `transaction.id`                       | join key, one row per transfer             |
| B   | `data`        | `date`                                 | `YYYY-MM-DD` slice (same `isoDate` helper) |
| C   | `typ`         | transfer-type PL label                 | **SUMIF key**                              |
| D   | `opis`        | `description`                          |                                            |
| E   | `kwota`       | `amount`                               | signed; CORRECTION may be negative         |
| F   | `pracownik`   | `worker` relation name                 | PAYOUT only, blank otherwise               |
| G   | `kategoria`   | `expenseCategory`/`otherCategory` name | CORRECTION/OTHER context, blank otherwise  |
| H   | `notatka`     | `invoiceNote`                          |                                            |

The summary block starts at the column after `notatka`.

**Summaries:** one `SUMIF(typ_col, "<type label>", kwota_col)` per transfer type,
reusing `buildMaterialySummary`'s mechanism (full-column ranges, literal
criterion, locale-aware separator). **No `RAZEM` grand total** — summing
money-in (`INVESTOR_DEPOSIT`) with money-out (`PAYOUT`) with billing/markup
(`LABOR_COST`) with a discount (`RABAT`) with `LOSS` and signed `CORRECTION`
produces a number with no financial meaning. Per-type subtotals only.

## Sign convention (drives criterion 2)

All six types store `amount` **positive** except `CORRECTION`, which may be
negative. The investment view's per-type filtered totals come from
`sumFilteredByType` (`src/lib/db/sum-transfers.ts`) via `fetchFilteredByType`
(`src/lib/queries/reference-data.ts:208`), which sums `amount` **as-is, no sign
flipping**, with `cancelled IS NOT TRUE`.

Therefore a sheet `SUMIF` over raw stored `amount` matches the filtered view
**1:1** for every type. The display negation in `map-category-costs.ts:14` is
header-only and does not touch these per-type totals.

## Architecture: generalize, don't fork

Thread a tab-config object through the four sheet primitives instead of the
module constants:

```ts
type SheetTabConfigT = {
  tabName: string
  header: string[]
  fieldMatchers: Record<string, (h: string) => boolean> // adds `worker` for the transfers tab
  summaryKeys: string[] // type labels for the per-type SUMIFs
  includeGrandTotal: boolean // true for expenses (RAZEM), false for transfers
}
```

- `setupMaterialyTab`, `applyMaterialRowsBatch`, `readMaterialyTransferIds`,
  `removeMaterialRow` take a `SheetTabConfigT` instead of closing over
  `MATERIALY_TAB` / `MATERIALY_HEADER` / `FIELD_MATCHERS` / `TAB_RANGE`.
- The existing expenses tab becomes **config A**; its emitted Google API requests
  must remain byte-identical (regression lock).
- The transfers tab is **config B**.
- The only genuinely new data code is a `transferRow()` builder mapping each of
  the six types to the 8 columns (counterpart to `expenseRow()` in
  `sheets-sync.ts:81`).

`includeGrandTotal: false` is how RAZEM is dropped for config B without
special-casing the summary builder beyond a flag.

## Wiring

The four existing entry points become tab-aware and write **both** tabs:

- `applyMaterialSync` (reconcile / manual "Sync" button) — reconciles expenses
  tab and transfers tab for the investment.
- `syncSingleTransferToSheet` — routes by `type`: `INVESTMENT_EXPENSE` → expenses
  tab; one of the six → transfers tab; `CANCELLATION` → remove from whichever tab
  the original belongs to.
- `syncBulkExpensesToSheet` — groups and batches per tab as well as per
  investment.
- Collection hooks `syncSheetAfterChange` / `syncSheetAfterDelete`
  (`src/hooks/transfers/sync-sheet.ts`) — unchanged trigger points; the sync
  functions they call handle both tabs.
- Link / setup flow (`ensureMaterialyTab`, `linkSheetAction`,
  `setupSheetAction`) — calls `ensureTab()` for both configs; non-destructive
  (never wipes a populated tab).

## Test Plan

Maps directly to the three success criteria.

### Criterion 1 — no regression (expenses tab byte-identical)

Characterization test written **on current code first**, before any refactor:

- Seed 2–3 investments with a representative spread of `INVESTMENT_EXPENSE`
  transactions (incl. a cancelled one, a non-finite/empty amount, a missing
  category).
- Run the expenses sync (`applyMaterialSync` / `applyMaterialRowsBatch` /
  `setupMaterialyTab`) against a **mocked `sheets_v4` client** that captures the
  `batchUpdate` / `values.batchUpdate` request payloads.
- Snapshot the captured requests. Commit this as the golden baseline.
- After the refactor, assert the expenses-tab requests are byte-identical to the
  baseline. This is the regression lock.

### Criterion 2 — sheet totals == filtered view 1:1

Pure-logic test, no Google API:

- For each seeded investment and each of the six types, assert
  `sum(kwota of rows transferRow() emits for type T)` equals
  `fetchFilteredByType(investment)` total for `T`.
- Explicitly cover `CORRECTION` with a negative amount (sign preserved) and
  `LOSS` both with and without an investment (the un-linked one must not appear
  on any tab and must not affect any investment's total).
- Assert the `cancelled != true` filter excludes cancelled transfers from both
  the sheet rows and the comparison.

### Criterion 3 — live sync correctness

- **Manual checklist:** click "Sync" on an investment → transfers tab is created,
  rows are present and valid, per-type `SUMIF` cells show correct numbers, tab is
  read-only.
- **Optional gated integration test** (opt-in via env flag, off by default
  because repo policy is cautious about live Google writes): write to a scratch
  sheet, then read back **evaluated** SUMIF values
  (`valueRenderOption=UNFORMATTED_VALUE`) and assert they equal the expected
  per-type totals — proves the formulas calculate, not just that they were
  written.

### Open item for planning (not a blocker)

How the seed step provisions data without touching the real local DB
(`wykonczymy-db`). Follow whatever `src/__tests__/.../sum-transfers.test.ts`
already does (mocked payload vs. dedicated test DB); do not seed against live
data.

## Risks / notes

- **`transfers.ts` is the canonical type list** and changed twice today
  (`RABAT`, then `LOSS`). The planner must re-read `showInvestment` before coding
  rather than trust the six listed here.
- **`kategoria` column is intentionally muddy** (expense category / blank).
  Acceptable for a temporary overview tab; revisit if this tab becomes permanent.
- **Hand-write the migration** if any DB change is needed (none expected — this
  is sheet-side only). `pnpm migrate:create` emits phantom drift (AGENTS.md).
- Keep the expenses-tab code path single-sourced; a forked copy of the
  setup/batch/protection code is the worse long-term debt even though this tab is
  "temporary."
