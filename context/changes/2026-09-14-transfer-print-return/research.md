---
date: 2026-09-14T17:24:26+02:00
researcher: Claude Opus 5
git_commit: e1c959f675ebb4d9decf5f72249e4f12b48435d0
branch: drag-drop-guard
repository: wykonczymy
topic: 'Transfer print removed by EX-672 — what it was, why a revert cannot land, and what its return would cost inwestycje v2'
tags: [research, transfers, print, export, ex-672, ex-673, inwestycje-v2, parity]
status: complete
last_updated: 2026-09-14
last_updated_by: Claude Opus 5
last_updated_note: 'Scope decided — thin print of the filtered row list, no financial header; original behaviour verified from the deleted code'
---

# Research: przywrócenie drukowania transakcji (EX-672)

**Date**: 2026-09-14T17:24:26+02:00
**Git Commit**: e1c959f675ebb4d9decf5f72249e4f12b48435d0
**Branch**: drag-drop-guard

## Research Question

Printing transactions from the investment card was deleted on 2026-08-12 (EX-672). The owner reports
it was in use. What exactly was deleted, how did it compute its figures, and what would a return cost
in the world of inwestycje v2 (kosztorys as the robocizna source, the brutto plane, the reconciliation)?

## Summary

Five findings, in order of how much they change the answer.

1. **Ask first which „Drukuj" the owner means.** One print button survives and works today — the
   invoice preview's („Drukuj" on a faktura, `src/components/dialogs/invoice-preview-dialog.tsx:209`),
   reachable from the transfers table's invoice cell, the edit form, the expense form and the kosztorys
   Wydatki tab. It is the only live print path in the app. If that is what was in use, there is nothing
   to rebuild. Scoping anything before this is answered is guesswork.

2. **What was deleted was not a printout of the table — it was a financial document.** The deleted
   `PrintButton` printed a three-column header of financial figures plus the rows, and it computed its
   own „Bilans" by summing the _visible_ v1 stat tiles through a global Zustand store
   (`git show 12d45c44^:src/lib/export/header-fields.ts`). The commit message names this as the reason
   for the kill: _"Print was not a screenshot — it was a second independent reader of the financial
   figures."_ That header is the entire difficulty; the rows are trivial.

3. **A revert cannot land.** Seven of the modules the patch touches no longer exist under those names,
   and three behaviours the printout depended on were changed after it was deleted (§ _Why a revert
   cannot land_).

4. **The v2 impact is not a cost of the feature — it is a question the feature forces.** The deleted
   print sourced its figures from the **v1** tiles. Under today's default reading (`?widok=v2`) the
   investment page renders no tiles at all — `InvestmentSummaryPanel` renders instead. So a restored
   header has no source on the default view, and „print the transactions" has to declare which plane
   it is a document of. Restoring the v1-sourced version means keeping v1 alive, which is what EX-673
   exists to end. See § _Impact on inwestycje v2_.

5. **The 2026-08-12 ruling may have cancelled something the owner did not mean to cancel.** On
   2026-07-26 the owner said browser print was being phased out **in favour of a PDF**
   (`context/archive/2026-07-26-investment-summary-panel/change.md:36-40`). On 2026-08-12 the ruling was
   recorded as "both features unnecessary" and EX-672's plan-brief wrote down **"PDF replacement — None
   owed."** Nothing in the record shows the owner being asked to confirm that the July promise was
   cancelled rather than merely postponed. "Print is unnecessary _because a PDF is coming_" is a reading
   the two statements are equally compatible with.

## Detailed Findings

### 1. What exactly was deleted

Six commits on 2026-08-12, `d252498c` → `8378d834`. The deletion itself is `12d45c44` (~530 lines):

| Module                                                 | Lines | What it did                                                                        |
| ------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------- |
| `src/components/transfers/print-button.tsx`            | 75    | the „Drukuj" trigger                                                               |
| `src/components/transfers/csv-button.tsx`              | 54    | CSV sibling                                                                        |
| `src/components/transfers/transfer-export-toolbar.tsx` | 41    | held both, plus invoice download                                                   |
| `src/lib/export/print.tsx`                             | 107   | `buildPrintHtml` — `renderToStaticMarkup` → `<!DOCTYPE html>` + inline `@page` CSS |
| `src/lib/export/print-iframe.ts`                       | 26    | hidden iframe, `doc.write`, `setTimeout(…, 100)`, `print()`                        |
| `src/lib/export/header-fields.ts`                      | —     | **`calculateBalance(fields, visibility)`** — the second reader                     |
| `src/lib/export/transfer-columns.ts`                   | 53    | `TRANSFER_EXPORT_COLUMNS` registry shared by print + CSV                           |
| `src/lib/export/sort-rows.ts`                          | 47    | replayed the table's `SortingState` on the refetched rows                          |
| `src/lib/export/csv.ts`                                | 21    | —                                                                                  |
| `src/stores/header-fields-store.ts`                    | 18    | global mirror of the tile toggles                                                  |
| `src/__tests__/build-print-html.test.ts`               | 91    | the only spec; deleted with its subject                                            |

`bef9379a` then stripped the four producer pages (`inwestycje/[id]`, `kasa/[id]`, `pracownicy/[id]`,
`raporty`) of `headerFields`, plus `context` / `contextId` / `totalPayouts` / `ExportContextT` from
`TransferTableConfigT`. The app-wide `@media print` block went too (`src/styles/globals.css:251`).

**How it worked, end to end** (`git show 12d45c44^:src/components/transfers/print-button.tsx`):

1. `fetchFilteredTransfers(config.query.where)` — a server action refetching the **whole** filtered set,
   because the on-screen table is paginated.
2. `sortTransferRows(rows, sorting)` — replay the table's sort.
3. Header fields: `config.headerFields` filtered by `useHeaderFieldsStore().visibility`, then
   **`calculateBalance(headerFields, visibility)`** appended as a „Bilans" row — a sum of the tile
   amounts the owner had left checked.
4. `buildPrintHtml(rows, visibleColumnIds, visibleHeaderFields, title)` → `printViaIframe(html)`.

Two generations preceded it: a server-rendered `src/app/(print)/drukuj/transfery` route group (removed
at `868eeb35`), replaced in March 2026 by the client-side iframe print
(`docs/plans/2026-03-04-client-side-print.md`, recoverable at `7af723cc^`). A return would be the third.

### 2. Why a revert cannot land

Everything below changed **after** 2026-08-12 and breaks a `git revert` or a `git checkout <sha>^ --`:

- `src/types/export.ts` **no longer exists.** `TransferTableConfigT` moved to
  `src/components/transfers/transfer-table-config.ts:7-24`; `FinancialFieldT` moved to
  `src/types/investment-financials.ts:95-99` and is now a standalone `{label, value, amount}`;
  `HeaderFieldT` is gone entirely.
- `src/lib/actions/export.ts` was renamed to **`src/lib/actions/fetch-transfers-for-invoices.ts`**
  (`fetchFilteredTransfers` at `:12-31`, `requireAuth(MANAGEMENT_ROLES)` at `:15`, always ANDs
  `cancelled != true` and `type != CANCELLATION`, unpaginated via `findAllTransfersForExport`,
  `limit: 50000`). Reusable as-is for "all pages of the current filter" — not for "this page only".
- `src/lib/export/` as a directory is gone (`invoice-zip.ts` → `lib/invoices/`,
  `download.ts` → `lib/utils/trigger-download.ts`).
- **`ToggleStatButtons` lost its `onToggle` prop** (`src/components/ui/toggle-stat-buttons.tsx`). The
  hidden set is local `useState` at `:51` and nothing outside the component can observe it. The whole
  premise of "print the bilans the owner currently sees" needs a new mechanism — lift the state, or
  accept a static figure.
- **`LOSS` semantics inverted** (`4a169452`, 2026-08-13, EX-675): strata is now a credit tile inside the
  toggleable row (`financial-stats.tsx:24`), the `totalLoss` prop is gone, and the bilans formula gained
  `+ Strata` (`:53`). A `calculateBalance` copied back from the deleted module would now be **wrong**.
- **Column ORDER became user state** (`88cbb781`, `be59be6a`, 2026-08-26): `ranks` / `columnOrder` in
  `data-table.tsx:85,115`, persisted via `src/lib/table/column-prefs-storage.ts:40-53`. The old print
  honoured visibility only; a restored one that ignores order will not match the screen.
- **The toolbar signature changed** — `toolbar` is now a render-prop taking one
  `DataTableToolbarContextT` object (`data-table.tsx:31-42`), not `(table, columnVisibility)`. The slot
  is intact and currently holds `CancelledTransactionAuditButton`, `CancelledFilterButton`,
  `InvoiceDownloadButton`, `ColumnToggle` (`transfer-data-table.tsx:65-74`).
- **One of the four host pages is gone.** `/raporty` is an `EmptyState` „W budowie" pending EX-598
  (`52b1f3d8`). Live hosts: `inwestycje/[id]:116`, `kasa/[id]:68`, `pracownicy/[id]:63`,
  `manager-dashboard.tsx:33`.
- Column labels moved: `vatPlane` is now „Forma wpłaty" (`VAT_PLANE_LABELS` → `DEPOSIT_PLANE_LABELS`),
  and `paymentMethod` is frequently `null` (`9ce604a5`).

**The silent trap, in both directions.** `headerFields` was optional on `TransferTableConfigT`, so
deleting a producer lit nothing up — `tsc` stayed green while four pages computed into the void
(`lessons.md`: _"An optional config field hides its own death"_). Re-adding it is equally silent:
nothing will tell you a page forgot to set it — the printout will just come out empty.

### 3. Impact on inwestycje v2

This is the part that makes a return a design job rather than a restore.

**a) Under the default reading there are no tiles to print.** `STATS_VERSION_DEFAULT = 'v2'`
(`src/lib/constants/stats-version.ts:10`). v1 renders `FinancialStats` (`page.tsx:96-102`); v2 renders
`InvestmentSummaryPanel` (`:106-113`). The deleted print's header was built from the v1 tiles, so on the
default view it has no source. Worse — and this is recorded in `lessons.md` as a worked example — since
`?widok=v2` became the default on **2026-07-26** the store was always empty, the "empty means everything"
fallback took over, and the printed bilans **was already static** for the 17 days before EX-672 deleted
the button. Whatever the owner was using, the dynamic part had been dead for a while, and that was
accepted at the time ("the dynamic bilans is NOT a requirement to carry over").

**b) The two planes disagree, on purpose, and a document must name its plane.** The seam is
`src/lib/kosztorys/summary-reading.ts`: `readingFromTransactions:20-25` (v1 — robocizna = Σ LABOR_COST −
Σ RABAT) vs `readingFromKosztorys:33-41` (v2 — off the kosztorys aggregate, **no fallback**). Only two
fields swap (`financialsOnReading:51-59`); every cash figure stays transaction-sourced in both readings.
A printout headed „Bilans" with no plane declared is a document that means two different things
depending on a URL param the reader never saw. On the listing the same split is rendered as **two
columns side by side** — `Bilans netto v1` / `Bilans netto v2`, `Marża v1` / `Marża v2`, `Robocizna v1` /
`Robocizna v2` (`src/components/tables/investments.tsx:115,122,163,172,192,198`).

**c) The no-fallback rule has to survive onto paper.** No kosztorys ⇒ robocizna 0, rabat 0. The listing
renders that zero as **„brak danych"** (`investments.tsx:32-47`) precisely because a bare 0 reads as "the
client owes nothing for work that was done". A printed document is the worst possible place to lose that
distinction — it leaves the building.

**d) The brutto plane is narrower than netto.** Only **bilans** exists on both planes
(`shape-investments.ts:78,88`); marża and robocizna have no brutto twin (`investments.tsx:132`). Outside
tryb brutto the listing prints „nie dotyczy" and carries the stranded-wpłaty sentence
(`off-plane-deposit-copy.ts`). A printout owes the same two behaviours.

**e) It re-opens the parity debt EX-672 closed.** `pnpm test:parity` compares **real assembly paths**
across two surfaces — listing (`shape-investments.ts`) and detail (`page.tsx` + `financial-stats`) —
`src/__tests__/investment-render-parity-db.test.ts:38-50,199-233`. Print was the third surface; the
commit that deleted it narrowed the spec to two. `lessons.md:21` states the rule: a parity test must call
the actual functions the surface renders. So a returning document surface owes a third leg in that
`compare` table — which in turn requires it to expose a **pure, importable builder** (the
`shape-investments.ts:20-23` precedent: kept out of `queries/` so it imports without `server-only`).

**f) The reconciliation is the reason the header is dangerous.** `buildKosztorysReconciliation`
(`src/lib/kosztorys/reconciliation.ts:70-96`) exists because the kosztorys and transactions planes are
_expected_ to disagree while work is still being typed in — the rozjazd is the to-do list, not a defect
(AGENTS.md). A printout that freezes one side of that disagreement onto paper, handed to a client or
filed, is a claim the app itself refuses to make on screen.

**g) The second-reader problem is not solved repo-wide, so the constraint is real, not theoretical.**
Today's v1 „Bilans inwestora" _is itself_ a sum of visible tiles — `computeSummary`
(`toggle-stat-buttons.tsx:33-38`) via `financial-stats.tsx:113-119` — structurally the same shape print
had. It is kept equal to the authoritative `src/lib/db/calculate-balance.ts:12-21` only by a unit test
(`__tests__/lib/queries/investment-financial-fields.test.ts:177-213`) and by the parity spec. Adding a
third consumer of that shape widens a crack that is already load-bearing.

### 4. What the project already has to build on

- **`(share)` route group — the strongest precedent and probably the intended shape.**
  `src/app/(share)/layout.tsx` is a bare, session-free, `noindex` shell; `/k/[token]` is the client
  entrance and `/podglad-inwestora/[id]` the owner's byte-identical preview, both rendering the _same_
  component as the editor under a `preview` flag. Disclosure runs through an allowlist
  (`src/lib/kosztorys/client-view-settings.ts:27-43`, `ClientViewModeT = 'OFFER' | 'SETTLEMENT'`) that
  **fails closed** on a malformed stored value (`:66+`), and `src/lib/queries/preview-kosztorys.ts:25-30`
  deliberately does **no** field-stripping — one cache entry, one reader, render-side disclosure. EX-591
  (`8326ee58`) is the load-bearing fix: under preview the owner's per-browser column preferences are
  skipped outright, because one owner's reading preferences must not shape the document every client is
  served. That is exactly the failure mode the old print had.
- **The one surviving print mechanism.** `invoice-preview-dialog.tsx:55-102` — `window.open('', '_blank')`
  - imperative DOM building (never a `blob:`/`data:` URL: opaque origin breaks relative Payload media
    paths), counting `load`/`error` across all pages before calling `print()` once. Dependency-free and
    hard-won; the _machinery_ transfers even though the content does not.
- **The only file-delivery leg.** `src/hooks/use-invoice-zip.ts` (dynamic `jszip` import, batched fetch,
  progress toast) + `src/lib/utils/trigger-download.ts`. `jszip` is the only document-ish dependency in
  `package.json` — **no pdf lib, no csv lib, no xlsx, no puppeteer**.
- **Formatting primitives** already correct for a document: `formatPLN` (`format-currency.ts:8`, the
  `+ 0` kills `-0,00 zł`), `formatPLDate` / `formatPLDateTime` pinned to `Europe/Warsaw`
  (`format-date.ts:6`), `roundToCents`, `SignedMoneyDisplay`, `section-share-pie.tsx`.

### 5. Constraints written down by the people who cut the feature

Both are owner-level and survive the cut:

1. **The document must read the same figures the screen reads** — EX-672's stated reason for deletion.
   Concretely: bilans from `calculateBalance(financials)` (v1) or `-computeAmountDue(...).net` (v2), never
   a reduce over rendered tile amounts; figures taken as props, not re-fetched (the `FinancialStats`
   margin contract, `financial-stats.tsx:70-72`); the VAT bridge only via `depositPairFromPlaneSums`;
   materiały only via `billedMaterials` / `materialsPair`.
2. **A column a client must not see has to be physically absent from the output, not hidden** —
   `roadmap.md:576-583`, recorded on EX-666: _"In the old sheets a hidden column was only hidden: anyone
   could unhide it in Excel and read purchase prices / marża / subcontractor prices."_

And one structural lesson aimed straight at this feature (`lessons.md`, on the deleted toolbar):
_"Parking two features' buttons in one component makes one feature's data the other's visibility gate."_
A restored print button carries its **own** explicit config flag — it must never re-ride `invoiceDownload`.

## Historical Context

| Date       | Decision                                                                                                                                                                | Source                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-03-03 | PDF export designed (jsPDF + jspdf-autotable, A4 landscape), 6 tasks, fully specified                                                                                   | `docs/plans/2026-03-03-pdf-export-{design,plan}.md` (recover at `7af723cc^`) |
| —          | **never built** — `git log -S'jspdf' -- package.json` is empty. Abandoned silently, no recorded decision. Its only surviving artifact was `lib/export/header-fields.ts` | —                                                                            |
| 2026-03-04 | server-rendered `(print)` route group replaced by client-side iframe print                                                                                              | `docs/plans/2026-03-04-client-side-print.md`                                 |
| 2026-07-26 | owner: browser print "is being phased out **in favour of a PDF**"; dynamic bilans not carried over                                                                      | `context/archive/2026-07-26-investment-summary-panel/change.md:36-40`        |
| 2026-07-26 | `?widok=v2` becomes the default ⇒ the printed bilans is silently static from here on                                                                                    | `lessons.md` (~:225-228)                                                     |
| 2026-08-12 | owner: "obie funkcje są niepotrzebne"; **"PDF replacement — None owed"**                                                                                                | EX-672 description, `plan-brief.md`                                          |
| 2026-08-12 | EX-672 ships. E2E "none owed" — argued from _absence of prior coverage_, never from absence of users                                                                    | `plan.md` Testing Strategy                                                   |
| 2026-08-15 | owner cuts **all** kosztorys export: CSV (EX-400) and PDF + live sheet (EX-666). The client view replaces both client-facing moments                                    | `roadmap.md:567-589` (S-14 tombstone)                                        |

**Status today (live Linear, project "Wykonczymy"):** EX-672 Done/archived · **EX-673** (v1 sunset)
Backlog, `parked`, never started — **v1 is still fully alive in code** · **EX-712** Backlog, `parked` ·
EX-666 Canceled · **EX-456** ("E2E: invoice preview «Drukuj»") Backlog, `e2e-backlog` — the only live
print issue in the workspace. **No issue exists asking to restore transfer print or CSV.**

EX-672 collected its cost without EX-673 collecting the benefit: v1, the `?widok` axis and
`FinancialStats` are all still here a month later.

**Roadmap collision check:** none. Every slice is `done` except O-01 `sentry-observability` (proposed),
S-16 `editor-e2e-coverage` (deferred) and the tombstones. The four in-flight change folders
(`katalog-sprzetu`, `subcontractor-override-value-collapse`, `worker-payouts-on-employee-card`,
`drag-drop-guard`) touch neither transfers nor any financial surface.

One reasoning inversion worth noting: the S-14 tombstone justified cutting kosztorys export partly with
_"EX-672 deleted the transfers CSV/print layer, so there was no infrastructure left to reuse."_ Building
a document layer now removes one of S-14's two stated blockers — the other (an undecided export
contract) still stands.

## Code References

- `src/app/(frontend)/inwestycje/[id]/page.tsx:92-125` — the v1/v2 branch and the `TransfersSection` config
- `src/lib/constants/stats-version.ts:10` — `STATS_VERSION_DEFAULT = 'v2'`
- `src/components/transfers/transfer-data-table.tsx:65-74` — the toolbar render-prop, print's former home
- `src/components/transfers/transfer-table-config.ts:7-24` — today's config type
- `src/lib/actions/fetch-transfers-for-invoices.ts:12-31` — the unpaginated refetch print used
- `src/lib/kosztorys/summary-reading.ts:20-59` — the v1/v2 seam
- `src/lib/kosztorys/reconciliation.ts:70-96` — the rozjazd
- `src/lib/kosztorys/summary-economics.ts:112-130` — `computeAmountDue`, the v2 headline
- `src/lib/db/calculate-balance.ts:12-21`, `calculate-margin.ts:16-22` — the authoritative formulas
- `src/components/ui/toggle-stat-buttons.tsx:33-38,51` — `computeSummary` + the now-unobservable hidden set
- `src/__tests__/investment-render-parity-db.test.ts:38-50,199-233` — the two-surface parity table
- `src/components/dialogs/invoice-preview-dialog.tsx:55-102,209` — the surviving print
- `src/app/(share)/**`, `src/lib/kosztorys/client-view-settings.ts:27-43,66+` — the client-document precedent

## Open Questions

Ordered — 1 gates everything else.

1. **Which „Drukuj"?** The deleted transfers-table one, or the invoice-preview one that still works?
2. **Print, or the PDF July promised?** The August ruling cancelled the PDF; nothing shows the owner
   being asked to confirm that cancellation. The jsPDF design exists, fully specified, never installed.
3. **What is the document FOR?** Three answers with three different shapes: an internal working printout
   (rows only, no financial header — kills the second-reader problem outright); a document for the client
   (belongs in `(share)`, under the allowlist, with the "physically absent" rule); an archival record of
   a settlement (needs a plane and a date stamp, and conflicts with the rozjazd being live).
4. **Which plane, and is the header even wanted?** If the rows alone were what was used, questions 5–7
   evaporate.
5. **Static or dynamic bilans?** Dynamic needs the v1 tiles _and_ a way to observe their hidden set,
   which no longer exists — and keeps v1 alive against EX-673.
6. **Which pages** — `/raporty` is a stub, so three live hosts at most.
7. **The `@media print` block** — restoring it changes what _every_ page looks like on Ctrl+P. Flagged
   as an owner-visible decision once already.
8. **No Linear issue exists yet** for any of this.

Two findings EX-672 left deliberately open are still true and sit in the file a return would touch —
`transfer-table-config.ts`: `showTotalAmount` is read at `transfer-table-server.tsx:21` but set by zero
call sites, and `totalFilteredAmount`/`listsCancelled` are server-derived yet share the caller's config bag.

## Follow-up Research 2026-09-14 — the thin restore

The owner cut the scope: **print the current filtered transaction list, nothing else.** No financial
header. That single decision dissolves most of the research above — §3 (impact on v2), §5 constraint 1
and the parity leg all exist only because the deleted printout carried figures. Rows are not figures.

What remains in force: the revert still cannot land (§2), and the toolbar lesson still applies — the
button carries its **own** config flag, never re-riding `invoiceDownload`.

### Original behaviour, verified against the deleted code

| Axis              | How it worked                                                                                                                                                                                                                                    | Evidence                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Scope             | whole filtered set, **all pages** — `fetchFilteredTransfers(config.query.where)` with no `page`/`limit`; pagination was a screen concern only                                                                                                    | `git show 12d45c44^:src/components/transfers/print-button.tsx:44` |
| Cancelled         | **excluded, deliberately** — the action ANDs `cancelled != true` and `type != 'CANCELLATION'`, commented _"they are audit trail only and have no place in CSV, print, or invoice ZIP output"_; introduced by `7a41e71a` ("exclude from exports") | `git show 12d45c44^:src/lib/actions/export.ts:20-23`              |
| Sorting           | replayed on the refetched set so the page matched the screen                                                                                                                                                                                     | `print-button.tsx:49` → `sortTransferRows`                        |
| Column visibility | honoured — `visibleColumnIds` derived from the table's `columnVisibility`                                                                                                                                                                        | `transfer-export-toolbar.tsx:18-26`                               |
| Column order      | **did not exist** — `ranks`/`columnOrder` landed 2026-08-26 (`88cbb781`, `be59be6a`)                                                                                                                                                             | `data-table.tsx:85,115`, `column-prefs-storage.ts:40-53`          |

Note: `lib/export/print.tsx`'s stylesheet carried `.cancelled { text-decoration: line-through }` — dead
style, a leftover from the earlier server-rendered generation, since the fetch could never return a
cancelled row. Do not carry it forward.

### Decisions (owner, 2026-09-14)

Scope, cancelled, sorting and column visibility: **exactly as the original**. Column order: **honoured**,
the one addition — read `ranks` in the same place the toolbar already reads `columnVisibility`.

### What exists vs what must be written

Reusable as-is:

- `src/lib/actions/fetch-transfers-for-invoices.ts:12-31` — `fetchFilteredTransfers(where)`, still
  `'use server'`, still `requireAuth(MANAGEMENT_ROLES)`, still unpaginated, and it still carries the
  cancelled/CANCELLATION exclusion the decision above keeps. **No change needed.** Its filename now names
  only one of its two consumers — rename or leave, but do not fork it.
- `src/components/transfers/transfer-data-table.tsx:65-74` — the toolbar render-prop, print's former home.
  `config.query.where` is in scope (`InvoiceDownloadButton` already uses it) and
  `DataTableToolbarContextT` (`data-table.tsx:31-42`) carries `table`, `columnVisibility`, `ranks`.
- `src/components/dialogs/invoice-preview-dialog.tsx:55-102` — the proven print mechanism: `window.open('', '_blank')`,
  build the document with DOM APIs, `print()` once content settles. The docblock's warning is load-bearing:
  a `blob:`/`data:` URL window gets an opaque origin where relative Payload media paths stop resolving.
- `formatPLN` (`format-currency.ts:8`), `formatPLDate`/`formatPLDateTime` (`format-date.ts`, pinned to
  `Europe/Warsaw` — a timestamped table hydrates wrong without it).

Must be written (deleted, nothing equivalent survives):

1. **A column → plain-text map.** `TRANSFER_EXPORT_COLUMNS` is gone and today's cells are React —
   badges, links, popovers, a two-line `amount` cell rendering brutto with a netto sub-line
   (`src/components/tables/transfers.tsx:38-59`). Print needs a flat string per column, and the `amount`
   cell is the one that carries real meaning in its second line.
2. **Sort replay** — `sortTransferRows` is gone; the table's `SortingState` is client state in
   `data-table.tsx:83`, the refetched set arrives `sort: '-date'`.
3. **The document builder + print stylesheet.** The app-wide `@media print` block was removed from
   `src/styles/globals.css:251` and does not need to come back — printing into its own window means the
   app's own pages stay untouched by Ctrl+P.

### Watch out

- **The optional-field trap, inverted.** A new `print?: boolean` on `TransferTableConfigT`
  (`transfer-table-config.ts:7-24`) is optional, so a page that forgets to set it lights nothing up —
  `tsc` stays green and the button simply never appears. Verify each intended host page by hand.
- **Three live hosts, not four.** `/raporty` is an `EmptyState` „W budowie" pending EX-598. Live:
  `inwestycje/[id]:116`, `kasa/[id]:68`, `pracownicy/[id]:63` (+ `manager-dashboard.tsx:33`, which
  deliberately opts out of the invoice button and should be asked about separately).
- **Column labels drifted** since the old registry: `vatPlane` is now „Forma wpłaty", and
  `paymentMethod` is frequently `null` (`9ce604a5`) — it renders `—` on screen and owes the same on paper.
- **Zero E2E coverage existed** for print, which is what made EX-672 argue "no regression window".
  A browser-level spec here is cheap and would have caught the deletion of a feature in use.
