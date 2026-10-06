# Skipped paragon — restore + per-paragon list rows — Plan Brief

> Full plan: `context/changes/2026-10-06-skipped-receipt-restore/plan.md`
> Research: `context/changes/2026-10-06-skipped-receipt-restore/research.md`

## What & Why

A paragon the manager drops while accepting the rest of a zgłoszenie must be restorable, and the
„Status” filter on „Zgłoszenia wydatków” must catch it (owner, EX-1009). Today the filter, the count
and the page size work per zgłoszenie while the table shows one row per paragon, so they disagree.

## Starting Point

- The history query returns one row per zgłoszenie. Both tables split those rows per paragon on the
  client (`splitByReceipt`), and that split has a bug when the transakcja is deleted.
- A skipped paragon row has no action. Only a wholly rejected zgłoszenie can be restored.

## Desired End State

- Every list row is one paragon straight from the database. „odrzucony” shows skipped paragony,
  „przyjęty” doesn't, and „N wyników” / „Pokaż N” count rows.
- „Przywróć” on a skipped paragon creates a „Czeka” zgłoszenie with that paragon's photos at its
  original send date. The skipped row disappears.

## Key Decisions Made

| Decision                       | Choice                                                                                         | Why                                                                                                         | Source           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| What restore means             | New pending zgłoszenie, pages shared with the accepted parent                                  | Re-opening the parent would rebook booked pages; moving pages would break its history and the media reclaim | Research         |
| Send date of the restored one  | Parent's original `sent_at`                                                                    | Owner                                                                                                       | Owner            |
| Parent's history after restore | Skipped row deleted, no marker                                                                 | Owner                                                                                                       | Owner            |
| List filter/pagination         | One SQL row per paragon (B)                                                                    | Count, page size and status sort match what's shown                                                         | Owner            |
| Worker page                    | Same SQL rows; `splitByReceipt` deleted                                                        | One split rule, not two                                                                                     | Plan             |
| AI read of the restored one    | Copy the parent's read row of that paragon; a fresh read via `after()` only when there is none | A paragon is exactly one read row, so there is no new AI call and „Zweryfikuj” is prefilled at once         | User, 2026-10-06 |
| Trashed party                  | Restore refused in the same statement; row shows no „Przywróć”                                 | lessons.md: never offer a restore that will be refused                                                      | Research         |
| Row type                       | `ExpenseDraftRowT` kept; `skippedReceipt?: { id, isRestorable }` replaces two fields           | Seven consumers keep their shape                                                                            | Plan             |

## Scope

**In scope:** the per-paragon SQL for the history and the worker list; deleting `splitByReceipt`; the
restore statement, action and button; DB and DOM regression specs; rewording the EX-1005 manual check.

**Out of scope:** migrations; the pending dashboard queue; a „przywrócony” marker; the inwestycja-filter semantics; the `worker-reports` twin.

## Architecture / Approach

A `PARAGON_ROWS` CTE unions:

- booked transakcje;
- skipped receipts (as `rejected`);
- one draft-level row for a draft with no transakcja.

A per-draft row count is computed before filtering, so a one-row zgłoszenie still shows all its pages.
The status filter, count and sort read the row's own status, and `LISTED_DRAFT` still reads the
zgłoszenie's. The restore is one CTE statement: delete the skipped row (only if the parent is accepted
and no party is trashed), insert the draft, then insert its pages from the parent's.

## Phases at a Glance

| Phase                        | What it delivers                                             | Key risk                                                            |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1. Paragon rows from SQL     | Filter, count, sort and pagination per paragon on both lists | Page set per row must match today's (one-row draft shows all pages) |
| 2. Restore a skipped paragon | „Przywróć” → new pending zgłoszenie, race-safe               | Shared pages must survive a delete of the restored draft            |

**Prerequisites:** none (the schema is in place since `20261006_3`).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The CTE scans all drafts before filtering. That is fine at hundreds of drafts; scope it if volume
  grows.
- The worker can delete the restored zgłoszenie. The paragon is then gone for good, since the skipped
  row no longer exists. This is accepted as the worker's call.

## Success Criteria (Summary)

- Filtering by „odrzucony” lists every skipped paragon. „Pokaż 10” shows exactly 10 rows.
- „Przywróć” turns a skipped paragon into a „Czeka” zgłoszenie that can be verified and booked like any
  other.
