# Kosztorys Sync — Edit Propagation Design (2026-05-27)

> Closes review finding **#4** ("Edits never reach the sheet — silent, unrecoverable
> drift"). Branch `table`. This design makes an edit to an already-synced
> `INVESTMENT_EXPENSE` reach its Google Sheet row, and makes any resulting drift
> recoverable via manual re-sync.

## Problem

The Materiały sync is **append-only**, keyed by `transferId`:

- `syncSingleTransferToSheet` returns early when the id is already present.
- `applyMaterialSync` / `previewMaterialSync` only append rows the sheet is missing
  (`!sheetIds.has(id)`).

So once an expense is synced, editing it (date, description, `expenseCategory`→`typ`,
`otherCategory`→`category`, `invoiceNote`→`note`, or reassigning `investment`) never
updates the sheet, and **manual re-sync can't fix it either** — the id already exists,
so it's skipped. The sheet silently diverges from the DB.

A `typ` change is the most damaging: it desyncs the per-type `SUMIF` totals and the
row coloring. Amount is **not** editable for `INVESTMENT_EXPENSE` (only `LABOR_COST`),
so amount drift via the normal edit path is not a concern.

Reassigning `investment` is a normal data-entry correction (mis-pick from the
investment dropdown, then fix), not an edge case — its drift must be handled.

## Approach

**A — live push + reconciler heal**, plus targeted removal on investment move.

- **Live push** gives immediacy and parity with create/cancel (which already push via
  `after()`).
- **Reconciler heal** is the recovery net: `after()` is fire-and-forget and can be
  dropped on a serverless crash/timeout, which would re-introduce unrecoverable drift.
  The reconciler is what actually closes #4's "even by manual re-sync" wording.

Reconciler scope is **append + update only** — it never deletes. The single deletion
path is the explicit `removeMaterialRow` on investment move, which removes only the one
row it is told to. This preserves the "reconciler never destroys data" property the
rest of the system relies on (e.g. #1's race reasoning, #7's accepted blast radius).

## Components

### 1. `updateMaterialRow(spreadsheetId, rowNumber, input)` — `lib/google/sheets.ts`

Mirror of `appendMaterialRow`, but writes the 7 mapped cells to a **known** row instead
of the next empty one. Reuses `resolveHeaders` for column positions and the same
`valueByField` mapping. Returns nothing (or `{ rowIndex }` for symmetry).

### 2. `removeMaterialRow(spreadsheetId, transferId)` — `lib/google/sheets.ts`

- `readMaterialyTransferIds` → find the 1-based row for `transferId`; no-op if absent.
- Fetch the tab's numeric `gid` (small `spreadsheets.get` on
  `sheets(properties(sheetId,title))`).
- `deleteDimension` (ROWS, `startIndex = row-1`, `endIndex = row`) via `batchUpdate`.

First and only deletion primitive; narrowly scoped to one row.

### 3. `syncSingleTransferToSheet` — update instead of skip — `lib/actions/sheets-sync.ts`

Replace the early `return` on `existing.has(transferId)` with:

- present → `updateMaterialRow(sheetId, existing.get(transferId)!, row)`
- absent → `appendMaterialRow(sheetId, row)` (current behaviour)

Stays non-fatal (logged, swallowed).

### 4. `updateTransferAction` — wire push + move — `lib/actions/transfers.ts`

After a successful update of a synced type, in one `after()`:

- if `relId(original.investment) !== parsed.data.investment` and the **old** investment
  has a `googleSheetId` → `removeMaterialRow(oldSheetId, transferId)`;
- always `syncSingleTransferToSheet({ transferId })` — targets the **current**
  investment's sheet (appends there if moved, updates in place otherwise).

Mirror the create/cancel `after()` pattern. Only fire for types that sync
(`INVESTMENT_EXPENSE`).

### 5. Reconciler heal by overwrite-by-id — `applyMaterialSync` / `previewMaterialSync`

The id is the join key, not a content fingerprint — an edit never changes the id, so
id-match alone can't detect drift. Rather than compare the 7 fields (which would need
string/number/date normalization against the sheet's all-string cells, with a
false-positive risk that rewrites every row), the reconciler **overwrites by id
unconditionally**:

- id absent in sheet → `appendMaterialRow` (as today).
- id present → `updateMaterialRow(sheetId, rowNumber, row)` to match the DB.

This heals any drift every sync with no comparison logic. Cost is rewriting unchanged
rows on a manual sync — negligible at this scale (hundreds of rows, one `batchUpdate`,
only the 7 mapped value cells touched; formatting and the protected range untouched).

- `applyMaterialSync` result gains an `updated` count (rows overwritten).
- `previewMaterialSync` still reports `toAppend` (new rows); it does **not** compute a
  drift list (we don't compare), so existing rows are simply "refreshed" on apply.

## Error handling

All sheet work remains non-fatal: edits never fail because of sheet trouble. Old-sheet
missing tab / unlinked investment → logged and skipped.

## Testing

- `sheets.test.ts`: `updateMaterialRow` writes the right cells; `removeMaterialRow`
  deletes the right row and no-ops on a missing id.
- `sheets-sync.test.ts`: edit of a synced expense updates in place; reconciler overwrites
  a present row to match the DB and appends a missing one (counts `updated` vs `added`);
  investment move removes from old sheet and appends to new.

## Out of scope

- Reconciler deleting orphans (only the explicit move-removal deletes).
- Making `cancelTransferAction`'s update+create atomic (tracked under #7).
- Other open findings (#9, #12, #13, #15).
