# Kosztorysy listing → sortable/filterable table

**Date:** 2026-05-29
**Status:** Approved (pending spec review)

## Problem

`/kosztorysy` is the only list page that does not use the shared `DataTable`
(TanStack Table). Investments, transfers, and users all render through
`components/ui/data-table/data-table.tsx` with `useSearchFilter`, `ColumnToggle`,
and `SearchFilterInput`. Kosztorysy instead renders three hand-rolled `Section`
card-lists, each with its own row component and a different primary action. It is
an outlier: no sorting, no filtering, no search, inconsistent look.

Goal: replace the three card-lists with a single sortable + filterable table that
matches the investments table pattern, but simpler (4 columns).

## Source data (unchanged)

The page already computes everything needed server-side:

- `fetchAllSheets()` → `SheetRowT[]` (sheet + optional linked investment), split
  into `linked` (has `investment`) and `unlinked` (no `investment`).
- `investmentsWithoutSheet` → investments with no sheet, derived from
  `refData.investments.filter((i) => !i.hasSheet)`.

No query changes. The page maps these three groups into one unified array.

## Unified row type

A single discriminated row collapses the three groups:

```ts
type SheetStatusT = 'linked' | 'unlinked' | 'no-sheet'

type SheetTableRowT = {
  id: string // synthetic stable key: `sheet-${sheetId}` or `inv-${investmentId}`
  status: SheetStatusT
  name: string // value the Nazwa column sorts/searches on
  investmentId?: number // present for 'linked' and 'no-sheet'
  investmentName?: string // present for 'linked' and 'no-sheet'
  sheetId?: number // present for 'linked' and 'unlinked'
  sheetName?: string // present for 'linked' and 'unlinked'
  googleSheetId?: string // present for 'linked' and 'unlinked'
}
```

Mapping rules:

- **linked**: `name` = investment name, all fields set, `id` = `sheet-${sheetId}`.
- **unlinked**: `name` = sheet name, no investment fields, `id` = `sheet-${sheetId}`.
- **no-sheet**: `name` = investment name, no sheet fields, `id` = `inv-${investmentId}`.

## Columns (4, simpler than investments' ~10)

Defined in `lib/tables/sheets.tsx` via `createColumnHelper<SheetTableRowT>()`,
mirroring `lib/tables/investments.tsx`.

| id          | header    | content                                                                                                          | sortable | hideable                  |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ------------------------- |
| `name`      | Nazwa     | linked/no-sheet → investment name as `Link` to `/inwestycje/{investmentId}`; unlinked → sheet name as plain text | yes      | no (`meta.canHide:false`) |
| `sheetName` | Kosztorys | sheet name for linked/unlinked; `—` for no-sheet                                                                 | yes      | yes                       |
| `status`    | Status    | `Badge` with Polish label (see below)                                                                            | yes      | yes                       |
| `actions`   | Akcje     | per-status CTA (display column, not sortable)                                                                    | no       | no                        |

Status labels / badge:

- `linked` → "Powiązany"
- `unlinked` → "Bez inwestycji"
- `no-sheet` → "Bez kosztorysu"

Actions column reuses the existing dialogs/buttons (no behavior change):

- `linked` → `Otwórz` button as `Link` to `/inwestycje/{investmentId}/kosztorys`
  (FileSpreadsheet icon), as in the current `LinkedRow`.
- `unlinked` → `LinkSheetToInvestmentDialog` with `sheetId`, `sheetName`,
  `availableInvestments`.
- `no-sheet` → `SheetSetupDialog` with `investmentId`, `investmentName`, and the
  same outline `Dodaj kosztorys` trigger as the current `NoSheetRow`.

`availableInvestments` (the picker options for `LinkSheetToInvestmentDialog`) is
the same `investmentsWithoutSheet` list, passed from the page into the client
table and forwarded into the column factory.

No `getRowHref` on the table — actions differ per row, so navigation lives only in
the Nazwa `Link`.

## Filtering & search

- **Search** (`useSearchFilter`): matches on `name` + `sheetName`. Reuses the
  existing hook and `SearchFilterInput`, identical to investments.
- **Status filter**: a new 4-way segmented toggle (user-chosen) —
  `Wszystkie / Powiązane / Bez inwestycji / Bez kosztorysu`. Implemented as
  `useState<SheetStatusT | 'all'>('all')` in the client wrapper, applied before
  search. New component `status-segment-filter.tsx` renders four buttons using the
  same `variant="activeFilter"` / `outline` language as `ActiveFilterButton`.
- **Column visibility**: `ColumnToggle`, reused unchanged.

Filter order in the wrapper: `data → status filter → search filter → table`.

## Files

### New

1. `lib/tables/sheets.tsx` — `SheetTableRowT`, `SheetStatusT`, `getSheetColumns({ availableInvestments })`.
2. `components/ui/status-segment-filter.tsx` — the 4-way segmented toggle. Props:
   `value: SheetStatusT | 'all'`, `onChange`, and the option list/labels.
3. `components/sheets/sheet-data-table.tsx` — `'use client'` wrapper mirroring
   `investment-data-table.tsx`: holds status + search state, builds columns via
   `useMemo`, renders `DataTable` with the toolbar (`SearchFilterInput`,
   `StatusSegmentFilter`, `AddSheetDialog`, `ColumnToggle`).

### Modified

4. `app/(frontend)/kosztorysy/page.tsx` — drop the three `Section`s; build the
   unified `SheetTableRowT[]`; render `<SheetDataTable data={...}
availableInvestments={...} />`. `AddSheetDialog` moves into the table toolbar
   (matching how `AddInvestmentDialog` lives in the investments toolbar). The
   `ALL_SHEETS_URL` external link stays in the page header above the table. No
   duplication of `AddSheetDialog`.

### Deleted (become dead once table replaces them)

5. `components/sheets/section.tsx`
6. `components/sheets/linked-row.tsx`
7. `components/sheets/unlinked-row.tsx`
8. `components/sheets/no-sheet-row.tsx`

## Reuse summary

Reused unchanged: `DataTable`, `useSearchFilter`, `SearchFilterInput`,
`ColumnToggle`, `Badge`, `LinkSheetToInvestmentDialog`, `SheetSetupDialog`,
`AddSheetDialog`, `Button`, `createColumnHelper`.

## Out of scope

- No query/server-action changes.
- No virtualization (`enableVirtualization` stays default `false`) — list is small.
- No row-click navigation.
- No persisted status filter (column visibility persistence via `storageKey`
  stays; status filter resets on reload, like the investments active filter).

## Testing

- Existing test `src/__tests__/hooks/sync-sheet.test.ts` is unaffected (hook logic).
- Manual: verify each status renders the correct CTA, search matches name + sheet
  name, segmented filter narrows correctly, Nazwa link routes to the investment,
  sort on each column works.
- Add a light unit test for the page's group-to-row mapping if extracted into a
  pure helper (decide during implementation).
