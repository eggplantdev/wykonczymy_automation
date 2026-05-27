# Kosztorys ↔ Investment Table Reconciliation — Design (2026-05-27)

> Make the kosztorys sheet a faithful 1:1 mirror of an investment's **active
> (non-cancelled) investment expenses**: same transaction ids, same row count, same
> totals as the default `/inwestycje/[id]` view (filtered to investment expenses).
> Branch `table`. Supersedes the cancellation `+ row / − row` model from the
> header-driven sync; builds on the `#4` primitives
> (`updateMaterialRow` / `removeMaterialRow` / `removeTransferFromSheet`).

## Problem

The sheet and the investment table disagree at the row level (totals already reconcile
after the SUMIF fix):

- Every cancellation produces a sheet row keyed by the **cancellation's own id**
  (e.g. #2460), and all 136 CANCELLATION rows have `investment_id = NULL`, so they
  **never appear** in any investment-scoped table.
- The sheet also keeps the **cancelled original** (#2459) as a `+` row; the investment
  table hides cancelled originals by default (only shows them, struck, under
  `showCancelled=1`).

Result for investment 6: the sheet carries 14 rows (7 cancelled originals + 7
cancellation rows) that the default investment view doesn't show.

## Target model — "active costs"

The sheet contains **exactly the non-cancelled `INVESTMENT_EXPENSE` rows** for the
investment. One row per expense, keyed by its own id. No cancellation rows. No
cancelled-original rows.

- **ids match**: sheet ids = active expense ids.
- **count matches**: same number of rows as the table's non-cancelled investment
  expenses.
- **totals match**: Σ non-cancelled expenses = the app's investment-expense total
  (verified: 48 243,57 for investment 6); per-type = the app's category breakdown.

Scope note: the kosztorys is expenses-only, so "match" is against the investment table
**filtered to non-cancelled `INVESTMENT_EXPENSE`** — not deposits, payouts, or labour.

## Components / changes

### 1. `loadAppMaterialRows` (`lib/actions/sheets-sync.ts`)

Return **only non-cancelled `INVESTMENT_EXPENSE`** rows.

- Filter the expense query with `cancelled != true` (add `{ cancelled: { not_equals: true } }`).
- Remove the cancellation `find` and the `−` reversing rows.
- `cancellationRow` and `cancellationReason` become dead → delete them.

### 2. `syncSingleTransferToSheet` — CANCELLATION branch flips (`lib/actions/sheets-sync.ts`)

Today the `CANCELLATION` branch appends a `−` row. New behaviour: it **removes the
original expense's row** from that expense's investment sheet.

- Resolve the original (via `cancelledTransaction`), confirm it's an `INVESTMENT_EXPENSE`,
  resolve its investment's `googleSheetId`, then `removeMaterialRow(sheetId, originalId)`.
- The `INVESTMENT_EXPENSE` branch is unchanged (append/update for non-cancelled).

`cancelTransferAction` needs no change — it already fires
`syncSingleTransferToSheet({ transferId: cancellation.id })` in `after()`.

### 3. Reconciler gains scoped orphan-removal (`applyMaterialSync`)

After append/overwrite of the active rows, remove sheet rows that no longer belong —
**but preserve manually-added rows**.

- Compute `orphanIds` = sheet ids not in the active `appRows` id set.
- One DB lookup: `payload.find('transactions', { where: { id: { in: orphanIds } } }, depth:0)`.
  The ids that come back are **real transactions** (cancelled originals, cancellation
  rows, or expenses moved to another investment) → `removeMaterialRow` each.
- Sheet ids that are **not** real transactions (owner's manual rows / unknown) → **keep**.
- Ordering: append missing, then overwrite present (row numbers from the initial id map
  stay valid — appends go to the bottom and don't shift existing rows), then removals
  last (each `removeMaterialRow` re-reads the grid, so sequential deletes are safe).

This makes a plain _Synchronizuj_ self-heal the existing 14 phantom rows without a
destructive reset; a reset already produces a clean mirror (tab cleared + resync).

### 4. Result shape / preview

- `applyMaterialSync` result gains `removed: number` → `{ added, updated, removed, errors }`.
- `previewMaterialSync` keeps `toAppend` (display-only). It does not compute removals.
- `sync-button.tsx` toasts include `removed` (e.g. `+N / zaktualizowano M / usunięto K`).

## Error handling

All sheet work stays non-fatal (logged, swallowed); cancelling/editing never fails
because of sheet trouble. A dropped `after()` is healed by the next reconcile.

## Testing

- `sheets-sync.test.ts`:
  - `loadAppMaterialRows`/`previewMaterialSync`: excludes cancelled expenses; **no**
    cancellation rows emitted (delete/replace the old `− reversing row` tests).
  - `syncSingleTransferToSheet` with a `CANCELLATION` → calls `removeMaterialRow` on the
    original's sheet, no append.
  - reconciler: appends missing, overwrites present, removes orphan ids that are real
    transactions, **keeps** an orphan id that is not a real transaction (manual row).
- Existing `removeMaterialRow` / `updateMaterialRow` unit tests already cover the primitives.

## Out of scope

- Showing cancellations in the investment table (rejected: "active costs" model).
- Backfilling `investment_id` onto the 136 existing cancellations.
- Other open findings (#9 superseded by the SUMIF fix; #12, #13, #15 remain).

## Migration / rollout

No DB migration. Existing sheets self-heal on the next _Synchronizuj_ (orphan-removal) or
_Zresetuj zakładkę materiały_ (clean rebuild).
