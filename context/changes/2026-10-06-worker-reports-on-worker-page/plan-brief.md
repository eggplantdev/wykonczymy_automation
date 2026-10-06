# Zgłoszenia wykonanych prac na stronie pracownika — Plan Brief

> Full plan: `context/changes/2026-10-06-worker-reports-on-worker-page/plan.md`
> Research: `context/changes/2026-10-06-worker-reports-on-worker-page/research.md`

## What & Why

On his own page, a worker sees no history of the zgłoszenia wykonanych prac he sent: no status, no
details, no way to open one. The only trace is „Wysłane zgłoszenia” on the link page (a date and a
count). The editor's review is management-only and desktop-only, so he needs a read-only „Podgląd”
that works at 390 px. On `/zgloszenia-prac`, a row click jumps straight into the kosztorys; that
entry should be a deliberate button instead.

## Starting Point

- No read lists one worker's reports across investments, and no read returns one report scoped to
  its worker. The existing reads are investment-scoped and management-only.
- The report list columns are a static Polish array.
- The status labels are Polish literals.
- The worker-page template already exists: „Zgłoszone wydatki”, with client-state paging and
  filters.

## Desired End State

- `/pracownicy/[id]` gets a „Zgłoszenia wykonanych prac” section: every zgłoszenie of that worker,
  link and skan, on any investment.
  - Filters: Status, Inwestycja, Pokaż.
  - Each row has „Podgląd”; management also gets „Otwórz w kosztorysie”.
- Podgląd opens in place. Per line it shows Nr, Sekcja, Opis prac, Zgłoszono and Przyjęto
  (qty / „czeka” / „odrzucona”). A skan also shows its photos.
- The worker reads all of it in his account language.
- On `/zgloszenia-prac`, the row is inert and the same two buttons act.

## Key Decisions Made

| Decision                       | Choice                                                                                              | Why (1 sentence)                                                | Source                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------- |
| Worker-page table              | A variant of the expense-drafts table, with paging and filters in state                             | The Transakcje table on the page owns the URL                   | change.md                  |
| How the worker opens a report  | New read-only Podgląd, a trimmed review table                                                       | The editor is management-only and desktop-only                  | change.md                  |
| Per-line result                | Reported qty + accepted qty / „czeka” / „odrzucona”, extras included                                | Matches the owner's request                                     | change.md                  |
| `/zgloszenia-prac` row click   | Removed; „Podgląd” + „Otwórz w kosztorysie” buttons instead                                         | Entry into the editor must be deliberate                        | change.md                  |
| Link page „Wysłane zgłoszenia” | Unchanged; no preview on the token path                                                             | Only logged-in users open a preview                             | change.md                  |
| Scans on the worker page       | Listed with a source column „z linku” / „skan”                                                      | Scans are his work too                                          | change.md                  |
| Scan photos in his preview     | Shown                                                                                               | Owner ruling                                                    | change.md (after research) |
| Pending label                  | „Do sprawdzenia” everywhere, one badge                                                              | One status, one name                                            | change.md (planning)       |
| „Źródło” + „Decyzja” columns   | On both lists                                                                                       | Same information on both lists                                  | change.md (planning)       |
| Access check                   | In the SQL, on the report's stored `worker_id`; foreign and missing ids both → `null`               | The client sends an arbitrary id, so the statement is the guard | Plan                       |
| Preview language               | Rendered on the server for the viewer; management gets the Polish opis + „Opis w języku pracownika” | Same rule as the editor's review dialog, kept as one function   | Research / Plan            |
| Investment scope               | Zakończona and trashed investments stay in his history                                              | It is history, not a work queue                                 | change.md                  |
| Status labels                  | `REPORT_STATUS_LABELS` → translation keys                                                           | Only UI consumers, and the worker reads them                    | Plan                       |

## Scope

**In scope:** two DB reads and their query wrappers; test-plan risk #25 with a DB spec; the pure
preview builder with a unit spec; the `workerReports` namespace (pl/uk/ru); the translated badge;
the column hook; the preview dialog and row actions; `/zgloszenia-prac` without the row link; the
worker-page section; DOM specs; the manual-checks entries that this change reverses.

**Out of scope:** edit / delete of a pending report by the worker (follow-up); any change to
`sent-reports.tsx`; accept / reject from the preview; translating `QueueFilters`; etapy, prices and
scan flags in the preview; a generic `DataTable` row click; the expense-drafts locale gap.

## Architecture / Approach

The data flows in one direction:

1. `lib/db` holds the reads: `listReportsByWorker` and `readReportPreview`, with the access
   predicate in SQL.
2. `lib/queries` wraps them: a `server-only` page fetcher gated by `canViewWorkerPage`, and a
   `'use server'` `fetchReportPreview`.
3. `lib/kosztorys/worker-report/report-preview.ts` builds the view. It is React-free and decides
   Przyjęto and the per-viewer opis.
4. `components/worker-reports/` renders it: one column hook, a fetch-on-click preview hook, the
   dialog, and the row actions, shared by both lists.

## Phases at a Glance

| Phase                                | What it delivers                                                         | Key risk                                       |
| ------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------- |
| 1. Reads and access                  | List per worker + preview read, risk #25, DB spec                        | A foreign report leaking through an id         |
| 2. View model and translations       | Preview builder + unit spec, `workerReports` namespace, translated badge | Splitting the opis rule from the editor's copy |
| 3. Preview dialog + /zgloszenia-prac | Column hook, dialog, row actions, inert row                              | Reversing the row click the owner was used to  |
| 4. Worker-page section               | Section + client-state table + DOM spec, manual-checks reversal          | 390 px layout of the sheet                     |

**Prerequisites:** the `worker-expense-drafts-history` review is committed (done). The pl/uk/ru
dictionaries carry another session's uncommitted hunks, so commit by pathspec and with your own
hunks only.
**Estimated effort:** ~1–2 sessions across 4 phases. No migration.

## Open Risks & Assumptions

- Management's Podgląd is read-only too; acting stays in the editor (assumed, consistent with
  change.md).
- A line whose pozycja was deleted falls back to the line's snapshot section and opis.
- The editor's report list keeps Polish through the provider fallback. No change is needed there.

## Success Criteria (Summary)

- A worker on his phone opens any of his zgłoszenia and sees, line by line, what was accepted, in
  his language.
- A worker cannot read anyone else's zgłoszenie or photos, whatever id he sends.
- Management reaches the kosztorys from a report only by clicking „Otwórz w kosztorysie”.
