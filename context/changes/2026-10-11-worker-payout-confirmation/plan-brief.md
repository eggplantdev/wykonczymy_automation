# Worker Payout Confirmation — Plan Brief

> Full plan: `context/changes/2026-10-11-worker-payout-confirmation/plan.md`
> Research: `context/changes/2026-10-11-worker-payout-confirmation/research.md`

## What & Why

Management books a wypłata; the worker confirms on his own page that he received it, or rejects it
with a reason. Management sees the answer on every transfers table, on a „Wypłaty" page and as a
pinned queue of rejections on `/`. It is the base EX-1040 (push + app badge) announces.

## Starting Point

`transactions` has no lifecycle column. A PAYOUT's amount, worker and kasa are frozen after booking;
every booking path is a Local API create through `validateTransfer`. Queue streams and pinned
dashboard blocks already exist for zgłoszenia prac / wydatków.

## Desired End State

New wypłaty are born `pending`. The worker sees a block at the top of his page with „Potwierdzam"
(confirm dialog) and „Odrzuć" (required reason), in his language. A rejection shows on `/` and as a
nav count until management cancels the wypłata or the worker accepts it. Old wypłaty show „—".

## Key Decisions Made

| Decision                    | Choice                                              | Why                                                   | Source           |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| Effect on figures           | None — label, not gate                              | Cash already left the kasa; many workers can't log in | Research / owner |
| Who is asked                | Every new wypłata                                   | Owner ruling 2                                        | Owner            |
| Storage                     | 3 nullable columns on `transactions` + CHECKs       | A label can't move a balance, so no separate table    | Research         |
| Old rows                    | `NULL`, rendered „—"                                | No worker accepted them                               | Research / owner |
| Decision write              | Raw-SQL `UPDATE` with ownership + state in `WHERE`  | Works on locked investments, no sheet re-sync         | Research         |
| Create default              | In `validateTransfer`                               | The one hook every booking path passes                | Plan             |
| Worker UI                   | Pinned block at the top, only while something waits | First thing seen on a 2–4 week visit                  | Plan             |
| Reason after change of mind | Kept                                                | Record of the dispute                                 | Plan             |
| Cancelled wypłata to worker | „Anulowana" in the block for 14 days                | Covers his visit rhythm, no new state                 | Plan             |
| Accept UX                   | Confirm dialog naming the amount                    | Accepting is final                                    | Plan             |
| „Zweryfikuj"                | Dialog with details, reason, cancellation           | Decide in place, like the drafts queue                | Plan             |
| Sheets                      | Unchanged                                           | Fixed 8-column tab                                    | Owner            |

## Scope

**In scope:** migration + fields, create default, decision actions, worker block (pl/uk/ru), table
columns + filter, `/wyplaty`, nav queue count, pinned rejected queue with „Zweryfikuj".

**Out of scope:** figures, sheets, backfill, push/badge (EX-1040), status on other types, reset on
edit, E2E.

## Phases at a Glance

| Phase                         | What it delivers                          | Key risk                                 |
| ----------------------------- | ----------------------------------------- | ---------------------------------------- |
| 1. Schema and booking default | Columns, CHECKs, `pending` on create      | An update overwriting a decision         |
| 2. Worker's decision (server) | Guarded accept/reject, reads              | A worker deciding someone else's wypłata |
| 3. Worker UI                  | Pinned block, two dialogs, 3 languages    | 390px fit                                |
| 4. Management surfaces        | Columns, filter, `/wyplaty`, queue on `/` | Filter unmapped in `where-to-sql` throws |

**Prerequisites:** local DB migrated; prod migrated by a human before the push.
**Estimated effort:** one session, 4 phases.

## Open Risks & Assumptions

- A rejected wypłata on a locked investment can be cleared only after unlocking it.
- Workers without a login leave wypłaty `pending` forever — accepted by ruling 2.

## Success Criteria (Summary)

- A worker confirms or rejects his wypłata from his phone; nobody else's.
- Management sees every answer without a reload, and every rejection until it is resolved.
- No figure anywhere changes.
