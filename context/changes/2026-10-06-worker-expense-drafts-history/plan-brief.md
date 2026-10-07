# Historia zgłoszeń wydatków — Plan Brief

> Full plan: `context/changes/2026-10-06-worker-expense-drafts-history/plan.md`
> Research: `context/changes/2026-10-06-worker-expense-drafts-history/research.md`

## What & Why

When a manager accepts a worker's expense draft, it becomes a transaction and the draft disappears
from view. Managers have no history of accepted and rejected drafts. Meanwhile the worker page lists
every draft the worker ever sent, with no paging, so it keeps growing. This reverses the EX-971
decision „no separate page”: the draft history gets its own manager page, and the worker page gets
the same table.

## Starting Point

`/zgloszenia-prac` is a complete template for this: URL filters, sort and paging, a queue order and
a nav badge. Drafts currently appear in two places:

- On Transakcje: a pinned pending block, plus rejected rows behind the „Zgłoszenia” toggle.
- On the worker page: an unpaged `SummaryTable`.

## Desired End State

- **`/zgloszenia-wydatkow`:**
  - pending drafts first;
  - filters: status, pracownik, inwestycja, data;
  - a Decyzja column (kiedy · kto);
  - accepted rows: the amount links to that transaction in the investment's list;
  - pending rows: „Zobacz” opens the existing accept dialog;
  - rejected rows: „Przywróć”.
- **Nav:** a new entry with a pending-count badge.
- **Worker page:**
  - the same table without „Pracownik”, 10 rows per page, the amount not linked;
  - transfers default to 20 instead of 100.
- **Transakcje:** the pending block and the „od pracownika” badge stay. The rejected rows and the
  toggle are removed.

## Key Decisions Made

| Decision            | Choice                                                            | Why (1 sentence)                                                                            | Source               |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Separate page       | Yes, a variant of `/zgloszenia-prac`                              | Gives the history a home with the same mechanics as worker reports.                         | Owner (change.md)    |
| Worker-page paging  | Client-side, 10 per page, no URL state                            | Two URL-paged tables on one page collide on `page`/`limit`/`sort`/`investment`/`from`/`to`. | Owner after research |
| „Wydatek” link      | `investmentTransfersHref(transferInvestment, { id })`, no `types` | Same as the kosztorys summary; a guessed type would filter out the linked row.              | Owner after research |
| Link investment     | From the transaction, not the draft                               | The manager may change the investment while accepting.                                      | Plan                 |
| Worker link         | None, plain amount                                                | A worker cannot open a transaction.                                                         | Owner                |
| Decyzja column      | On both pages                                                     | The worker also sees who decided and when.                                                  | Owner                |
| Trash rule          | Accepted always visible; rejected hidden if a party is trashed    | „Przywróć” would refuse it anyway (`PARTIES_NOT_TRASHED`).                                  | Owner after research |
| Accept dialog       | Extracted from `PendingExpenseDrafts` into a hook, shared         | One owner of the accept/reject flow; no copy.                                               | Plan                 |
| Page-number control | Extracted from `UrlPagination`, shared with the state variant     | Same rendering for URL and local paging; no copy.                                           | Plan                 |
| Mobile columns      | Unchanged; horizontal scroll                                      | Owner ruling.                                                                               | Owner                |

## Scope

**In scope:**

- Data layer: list, facets, pending count, a wider row, the trash rule.
- The manager page, its nav entry and badge.
- The worker-page table and the transfers default of 20.
- Removing the rejected rows and the toggle from Transakcje.
- pl/uk/ru strings and the manual-checks registry.

**Out of scope:**

- Filters or sort on the worker table.
- A per-worker filter on Transakcje.
- Linking every transfer of a draft accepted as several lines.
- An AI-status indicator.
- Cache tags.
- Schema changes.

## Architecture / Approach

The SQL sits next to the existing draft statements in `lib/db/worker-expense-drafts.ts`. An uncached,
management-checked fetcher goes in `lib/queries`. The client is `DataTable` + `PaginationFooter` +
filters, as on `/zgloszenia-prac`. One column factory (`components/tables/expense-drafts.tsx`)
serves both pages; options choose the worker column, the link, and the edit actions.

## Phases at a Glance

| Phase               | What it delivers                                                           | Key risk                                                       |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Data layer       | History query, facets, badge count, wider row, trash rule                  | Linking by the draft's investment instead of the transaction's |
| 2. Manager page     | `/zgloszenia-wydatkow`, nav badge, shared columns, extracted accept dialog | The extraction regresses the pinned block on Transakcje        |
| 3. Worker page      | Client-paged table, edit actions, transfers 20                             | 390 px layout; the URL must stay untouched                     |
| 4. Clean Transakcje | Rejected rows and toggle removed, tests and manual-checks updated          | Leftover references to the removed scope                       |

**Prerequisites:** none. No migration. The DB specs need the 5435 `db-test` container.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- A transfer deleted after acceptance leaves `transfer_id` NULL, and the amount shows „—”.
- A worker's full history loads in one request. That is fine for hundreds of rows; revisit only if
  one worker reaches thousands.

## Success Criteria (Summary)

- A manager finds any past draft (accepted or rejected) on one page and jumps from it to the booked
  transaction.
- A worker on a phone sees their drafts 10 at a time, with the decision and the amount.
- Transakcje shows transactions plus the pending queue, nothing else.
