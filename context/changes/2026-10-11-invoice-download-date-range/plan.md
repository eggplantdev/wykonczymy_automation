# Invoice download dialog with a required date range — Implementation Plan

## Overview

The „Faktury” button in the transfers table (EX-1039) stops packing a ZIP on click. It opens a
dialog instead: a required date range (both bounds) and a live count of the documents that range
will download. „Pobierz” packs exactly what the counter counted.

## Current State Analysis

- `src/components/transfers/invoice-download-button.tsx` — one click: `fetchRows()` →
  `useFileArchive().download(rows, [], INVOICE_ARCHIVE_COPY)`. No range, no confirmation.
- `fetchRows` is built in `transfer-data-table.tsx:58` as
  `fetchFilteredTransfers(config.query.where, opts)` — the page's full `Where` (page scope + URL
  filters, including the table's own Od/Do as a `date` leaf).
- `fetchFilteredTransfers` (`src/lib/queries/fetch-transfers-for-invoices.ts`) is a
  management-only `'use server'` read that already drops cancelled rows and CANCELLATION records.
  `PrintTransfersButton` shares it and must keep its current behaviour.
- The button is rendered only where `config.invoiceDownload` is set: `/inwestycje/[id]`,
  `/kasa/[id]`, `/pracownicy/[id]` (manager only). Scope stays exactly that.
- The `date` leaf's position in the `Where` differs per page: top level on `/inwestycje` and `/kasa`
  (beside the kasa's `or`), and inside `buildWorkerTransferWhere` on `/pracownicy`.
  `transfer-filters.ts` already owns a recursive leaf rewriter (`mapWhereLeaves`) used for exactly
  this kind of surgery.
- `DateRangePicker` (`src/components/filters/date-range-picker.tsx`) is a controlled
  Rok / Miesiąc / Od / Do picker designed for a local-state binding. `TelmakCheckDialog` is the
  precedent for a `Dialog` + `DateRangePicker` + `useLatestRequest` fetch-on-range-change, with the
  fetch fired from the handler, not an effect.

## Desired End State

- Clicking „Faktury” opens a dialog with the range picker. It opens pre-filled with the table's
  Od/Do when both are set in the URL; otherwise empty.
- With both dates picked, the dialog fetches the rows for that range (page scope + every other
  table filter kept, the table's own dates replaced) and shows „Dokumentów do pobrania: N”, where N
  is the number of files the archive will contain.
- „Pobierz” is disabled while the range is incomplete, while counting, and when N = 0. Clicking it
  packs the already-fetched rows (no second fetch), closes the dialog, and the existing progress
  toast takes over.
- Printing is unchanged.

### Key Discoveries:

- `buildTransferFilters` writes the URL window as `where.date = { greater_than_equal, less_than_equal }`
  (`src/lib/queries/transfer-filters.ts:155-160`).
- `mapWhereLeaves` (`transfer-filters.ts`, module-private) recurses `and`/`or` and drops a leaf when
  the rewrite returns `undefined` — the same mechanism `stripOriginalScopedFilters` uses.
- `flattenArchiveRows` (`src/lib/media/file-archive.ts:28`) is the exact file list `download()`
  packs; rows' `invoices` already exclude media without a URL (`resolveInvoiceFiles`). Counting
  `flattenArchiveRows(rows).length` therefore counts precisely what will be fetched into the ZIP.
- `buildArchiveName(parts, date, prefix)` sanitises and joins parts — passing the range as
  `nameParts` names the archive `faktury-<from>-<to>-<today>.zip`.
- `dayBound` (`src/lib/utils/date-range.ts`) is the existing validator for a client-supplied ISO day.

## What We're NOT Doing

- No button on any other surface (owner: only where it is today).
- No change to the print flow, to `useFileArchive`, or to the archive's contents/naming rules beyond
  adding the range to the archive name.
- No separate COUNT SQL query — the counter is derived from the fetched rows (see Approach).
- No change to the table's own Od/Do filter — the dialog's range never writes to the URL.

## Implementation Approach

The counter and the archive must never disagree, so they come from one fetch: the dialog fetches
the rows for the chosen range and both the count and the download read those rows. This replaces
the earlier idea of a server-side COUNT query — a second query would be a second definition of
„what gets downloaded” (cancelled rows, media without URL) that could drift from the first. The
cost is one row fetch per range change; a range on one investment / kasa / worker is tens to
low hundreds of rows, one Payload `find` plus one media lookup.

The range travels to the server as its own option and the server does the date replacement —
the client never edits a `Where`. The action re-validates both bounds with `dayBound`, as it
already re-validates `sort`, because it is a client-callable channel.

## Critical Implementation Details

- **Latest-wins.** Picking Rok then Miesiąc fires two fetches back to back; route every state write
  through `useLatestRequest` (as `TelmakCheckDialog` does) so a slow first response cannot overwrite
  the second range's count. Closing the dialog `disown()`s any request in flight.
- **No effect for the fetch.** Fire it from the range `onChange` and from the open handler (for a
  pre-filled range), not from a `useEffect` on `range`.
- **Od after Do** is reachable (Od/Do are typed independently). Show a distinct message instead of
  fetching — an empty window would otherwise read as an honest „0 dokumentów”.

## Phase 1: Server — range option on `fetchFilteredTransfers`

### Overview

Let the invoice fetch take a required-both-bounds range that replaces any date filter already in
the page's `Where`.

### Changes Required:

#### 1. Date replacement helper

**File**: `src/lib/queries/transfer-filters.ts`

**Intent**: Add an exported helper that removes every `date` leaf from a `Where` (at any depth) and
ANDs in the given closed window. Lives beside `mapWhereLeaves` because it is the same leaf surgery
the file already does for the audit scopes.

**Contract**: `withDateRange(where: Where, range: { from: string; to: string }): Where` →
`{ and: [whereWithoutDateLeaves, { date: { greater_than_equal: from, less_than_equal: to } }] }`.
Every non-`date` leaf (page scope, kasa `or`, type, category, worker, …) survives untouched.

#### 2. Range option on the action

**File**: `src/lib/queries/fetch-transfers-for-invoices.ts`

**Intent**: Accept an optional `range`; when present, validate both bounds with `dayBound` and
apply `withDateRange` before the existing cancelled/CANCELLATION scoping. An invalid or half range
returns a failure instead of silently widening to all time. Without `range` the action behaves as
today (print path).

**Contract**: `FetchFilteredTransfersOptsT` gains `range?: { from: string; to: string }`.
`TransferRowsFetchT` (`src/components/transfers/transfer-table-config.ts`) gains the same optional
field so the dialog can pass it through `fetchRows`.

### Success Criteria:

#### Automated Verification:

- `withDateRange` spec passes: `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts` — replaces a top-level `date` leaf, replaces one nested in `and`, leaves the kasa `or` and other filters intact, adds the window when there was no date leaf
- Action spec passes: `pnpm exec vitest run src/__tests__/lib/queries/fetch-transfers-for-invoices.test.ts` — a valid range reaches `fetchAllTransferRows` as the replaced window; a half or malformed range is refused without querying; the management-only guard still holds

#### Manual Verification:

- None for this phase (covered end-to-end in Phase 2).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: UI — the download dialog

### Overview

Replace the one-click button with a dialog that owns the range, the counter and the download.

### Changes Required:

#### 1. Dialog component

**File**: `src/components/transfers/invoice-download-dialog.tsx` (replaces `invoice-download-button.tsx`, which is deleted)

**Intent**: The „Faktury” trigger (same look, icon and aria-label as today) opens a `Dialog`
holding `DateRangePicker` bound to local state, a counter line, and a „Pobierz” action. Opening
seeds the range from the table's URL `from`/`to` (via `dayBound`) when both are present and
fetches immediately; otherwise it waits for a full range. Each complete range fetches rows through
`fetchRows({ range })` under `useLatestRequest`; the count is `flattenArchiveRows(rows).length`.
„Pobierz” calls `download(rows, [from, to], INVOICE_ARCHIVE_COPY)` and closes the dialog. A failed
fetch toasts with `failureMessage`, as today.

**Contract**: `InvoiceDownloadDialog({ fetchRows }: { fetchRows: TransferRowsFetchT })`. Counter
states: range incomplete → prompt to pick both dates; Od > Do → invalid-range message; fetching →
spinner; done → „Dokumentów do pobrania: N”. „Pobierz” enabled only in the done state with N > 0
and while no archive is being packed.

#### 2. Wiring

**File**: `src/components/transfers/transfer-data-table.tsx`

**Intent**: Render `InvoiceDownloadDialog` where `InvoiceDownloadButton` was, same `invoiceDownload` gate.

#### 3. Copy

**Files**: `src/lib/i18n/dictionaries/pl.ts`, `uk.ts`, `ru.ts` (`transfers` namespace)

**Intent**: Add the dialog title, the pick-a-range prompt, the invalid-range message, the counter
(with the count interpolated) and the „Pobierz” label in all three languages — the transfers table
is already translated, so a Polish-only string would show up on a Ukrainian screen.

### Success Criteria:

#### Automated Verification:

- DOM spec passes: `pnpm exec vitest run src/__tests__/components/transfers/invoice-download-dialog.test.tsx` — with no URL range „Pobierz” is disabled and the pick prompt shows; with `?from&to` in the URL, opening fetches with that range and shows the file count (a row with 2 pages counts 2); a range whose rows carry no files shows 0 and keeps „Pobierz” disabled; Od > Do shows the invalid-range message and does not fetch

#### Manual Verification:

- On `/inwestycje/[id]`: „Faktury” opens the dialog; picking Rok + Miesiąc shows a count; the ZIP downloaded via „Pobierz” contains exactly that many files and is named with the range
- With the table filtered by Od/Do, the dialog opens pre-filled with those dates and already counted
- With the table filtered by type (e.g. only Wydatki), the count drops accordingly — other filters are honoured, only the dates are replaced
- A month with no faktury shows 0 and „Pobierz” stays disabled
- Same flow on `/kasa/[id]` and on `/pracownicy/[id]` as a manager
- „Drukuj” still prints the table's current filter set, unaffected by the dialog

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `withDateRange` leaf replacement across the three `Where` shapes the pages build.
- Action: range validation and pass-through; management-only guard unchanged.

### Component Tests (dom):

- Dialog states and the count's definition (files, not rows). `fetchRows` is a prop, so the spec
  passes a stub — no server-action mock needed. Seed the range through `useSearchParams` rather than
  driving the Radix selects in jsdom.

### Manual Testing Steps:

See Phase 2 → Manual Verification.

## Performance Considerations

One row fetch per completed range change, latest-wins. The download then reuses those rows, so the
total server work per download is the same single fetch it is today.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

## References

- Linear: EX-1039
- Precedent: `src/components/telmak-check/telmak-check-dialog.tsx` (Dialog + DateRangePicker + useLatestRequest)
- `src/lib/queries/transfer-filters.ts` (`mapWhereLeaves`, `stripOriginalScopedFilters`)
- `src/lib/media/file-archive.ts` (`flattenArchiveRows`, `buildArchiveName`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server — range option on `fetchFilteredTransfers`

#### Automated

- [x] 1.1 `withDateRange` spec passes — 8a0ecce4c
- [x] 1.2 Action spec passes — 8a0ecce4c

### Phase 2: UI — the download dialog

#### Automated

- [x] 2.1 DOM spec passes — 5cd9db6be
