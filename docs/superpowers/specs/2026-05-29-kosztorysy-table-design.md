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

## Columns (2 — minimal; status/sheet name conveyed elsewhere)

Defined in `lib/tables/sheets.tsx` via `createColumnHelper<SheetTableRowT>()`,
mirroring `lib/tables/investments.tsx`.

| id        | header | content                                                                                                          | sortable | hideable                  |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------- | -------- | ------------------------- |
| `name`    | Nazwa  | linked/no-sheet → investment name as `Link` to `/inwestycje/{investmentId}`; unlinked → sheet name as plain text | yes      | no (`meta.canHide:false`) |
| `actions` | Akcje  | per-status CTA (display column, right-aligned, not sortable)                                                     | no       | no (`meta.canHide:false`) |

No separate Kosztorys or Status column: the Akcje button already names the state
(Otwórz / link dialog / Dodaj kosztorys), and the Status multiselect filters the
list. `status` stays on the row type purely to drive that filter.

Actions column reuses the existing dialogs/buttons (no behavior change):

- `linked` → `Otwórz` button as `Link` to `/inwestycje/{investmentId}/kosztorys`
  (FileSpreadsheet icon), as in the current `LinkedRow`.
- `unlinked` → `LinkSheetToInvestmentDialog` with `sheetId`, `sheetName`,
  `availableInvestments`.
- `no-sheet` → `SheetSetupDialog` with `investmentId`, `investmentName`, and an
  outline `Dodaj kosztorys` trigger (contextual: adds a kosztorys to that
  investment — distinct from the toolbar's global `Nowy kosztorys`).

`availableInvestments` (the picker options for `LinkSheetToInvestmentDialog`) is
the same `investmentsWithoutSheet` list, passed from the page into the client
table and forwarded into the column factory.

No `getRowHref` on the table — actions differ per row, so navigation lives only in
the Nazwa `Link`.

## Filtering & search

- **Search** (`useSearchFilter`): matches on `name` + `sheetName`. Reuses the
  existing hook and `SearchFilterInput`, identical to investments.
- **Status filter**: the existing `FilterMultiSelect` (the transfers component —
  "like other tables"), with options Powiązane / Bez inwestycji / Bez kosztorysu.
  Held as `useState<string[]>([])` in the wrapper; its URL-style encoding is
  reused in-memory — `[]` = all (no filter), `[FILTER_NONE]` = none, else the
  explicit subset (`deriveSelected`).
- **Column visibility**: no `ColumnToggle` — both columns are non-hideable, so it
  would render nothing.

Filter order in the wrapper: `data → status filter → search filter → table`.

## Default sort

The table loads sorted **by name (A–Z)** — flat alphabetical on the Nazwa column.
Status grouping is available on demand by clicking the Status header.

Two pieces:

- Initial `DataTable` sorting state of `[{ id: 'name', desc: false }]`.
  `DataTable` currently initializes `useState<SortingState>([])`; it needs an
  optional `initialSorting` prop (defaulting to `[]`) so kosztorysy can seed it
  without affecting the other tables.
- (The status column was dropped, so no status `sortingFn` is needed.)

## Files

### New

1. `lib/tables/sheets.tsx` — `SheetTableRowT`, `SheetStatusT`, `getSheetColumns({ availableInvestments })`.
2. `components/sheets/sheet-data-table.tsx` — `'use client'` wrapper mirroring
   `investment-data-table.tsx`: holds status + search state, builds columns via
   `useMemo`, renders `DataTable` with the toolbar (`SearchFilterInput`,
   `FilterMultiSelect`, `AddSheetDialog` as `Nowy kosztorys`).

(No new filter component — the status filter reuses the transfers
`FilterMultiSelect`.)

### Modified

3. `app/(frontend)/kosztorysy/page.tsx` — drop the three `Section`s; build the
   unified `SheetTableRowT[]`; render `<SheetDataTable data={...}
availableInvestments={...} />`. `AddSheetDialog` moves into the table toolbar
   (matching how `AddInvestmentDialog` lives in the investments toolbar). The
   `ALL_SHEETS_URL` external link stays in the page header above the table.
4. `components/ui/data-table/data-table.tsx` — add optional `initialSorting` prop
   (defaults to `[]`) so kosztorysy seeds name-ascending without affecting other
   tables.

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
