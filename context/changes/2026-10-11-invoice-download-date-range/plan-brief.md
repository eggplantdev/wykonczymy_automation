# Invoice download dialog — Plan Brief

> Full plan: `context/changes/2026-10-11-invoice-download-date-range/plan.md`

## What & Why

„Faktury” in the transfers table currently zips every faktura matching the table's filters in one
click (EX-1039). The owner wants a deliberate step: pick a date range, see how many documents it
covers, then download.

## Starting Point

`InvoiceDownloadButton` fetches the page's rows via `fetchFilteredTransfers` and hands them to
`useFileArchive`. The button exists on `/inwestycje/[id]`, `/kasa/[id]` and `/pracownicy/[id]`.

## Desired End State

„Faktury” opens a dialog with Rok / Miesiąc / Od / Do. Once both dates are set it shows
„Dokumentów do pobrania: N”; „Pobierz” downloads exactly those N files and is disabled at 0.

## Key Decisions Made

| Decision          | Choice                                              | Why                                                      |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Range vs filters  | Dialog dates replace the table's Od/Do; rest kept   | Owner                                                    |
| Required bounds   | Both dates                                          | Owner                                                    |
| What is counted   | Files to download (pages), not transactions         | Owner                                                    |
| Surfaces          | Only where the button is today                      | Owner                                                    |
| Counter source    | Fetch the range's rows; count + download reuse them | Count and archive cannot disagree; no second definition  |
| Where replacement | Server-side `withDateRange`, range re-validated     | Client never edits a `Where`; channel is client-callable |
| Initial range     | Table's URL Od/Do when both set, else empty         | Reuses the filter the user already chose                 |

## Scope

**In scope:** dialog, range option on the invoice fetch, counter, archive named with the range, pl/uk/ru copy.

**Out of scope:** new surfaces, print flow, a COUNT SQL query, writing the dialog range to the URL.

## Architecture / Approach

Dialog (local range state) → `fetchRows({ range })` → `fetchFilteredTransfers` applies
`withDateRange` to the page `Where` → rows → count = `flattenArchiveRows(rows).length` →
„Pobierz” → `useFileArchive().download(rows, [from, to], …)`.

## Phases at a Glance

| Phase     | What it delivers                               | Key risk                                       |
| --------- | ---------------------------------------------- | ---------------------------------------------- |
| 1. Server | `withDateRange` + `range` option on the action | Missing a nested `date` leaf (worker page)     |
| 2. UI     | The dialog, counter, wiring, copy              | Race between quick range changes (latest-wins) |

**Prerequisites:** none. **Estimated effort:** one session.

## Open Risks & Assumptions

- A range spanning a very large kasa could return many rows; acceptable at current data sizes (the
  current one-click flow already fetches the whole unfiltered set).

## Success Criteria (Summary)

- The number in the dialog equals the number of files in the downloaded ZIP.
- Without a full range nothing can be downloaded.
