# „Inny wydatek” — opcjonalny pracownik — Plan Brief

> Full plan: `context/changes/2026-10-08-other-expense-worker/plan.md`
> Research: `context/changes/2026-10-08-other-expense-worker/research.md`

## What & Why

„Inne wydatki” cover company purchases such as tools. Management wants to see how much worker X has
spent on them. An `OTHER` expense gets an optional worker, the person who bought it. The existing
filter plus the „Suma” tile then answer the question.

## Starting Point

The read side already works: the `worker_id` column, the `?worker=` filter, the „Pracownik” column
and the worker page scope. The write side refuses it, because the validate hook nulls the worker on
every type except PAYOUT/BONUS. The edit form has no worker field, and `/` does not render the
worker filter.

## Desired End State

- „Inny wydatek” has a „Pracownik” picker on every row, in „Kilka wydatków” too.
- The edit dialog of an `OTHER` row can set, change or clear the worker.
- `/` has the „Pracownik” filter.
- No money figure moves.

## Key Decisions Made

| Decision            | Choice                                                    | Why (1 sentence)                                                   | Source |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| Worker page         | An `OTHER` row with X shows on `/pracownicy/X`            | The scope already does this, at zero cost                          | Owner  |
| Edit after save     | Editable on `OTHER` only; PAYOUT/BONUS stay locked        | Lets the manager fix mistakes and backfill the 104 „narzędzia” rows | Owner  |
| Reporting           | Filter + „Suma” only, no breakdown table                  | A per-worker table is a new pattern nowhere else in the app        | Owner  |
| Bulk mode           | Worker per row on `OTHER`                                 | One receipt batch can mix buyers                                   | Owner  |
| Predicate           | `showsWorker` (allowed) next to unchanged `needsWorker`   | The repo's established shows/requires split                        | Plan   |
| Bulk storage        | Per-row field on `OTHER`, form-level stays PAYOUT/BONUS   | Two gates are simpler than one field whose meaning flips with type | Plan   |

## Scope

**In scope:**

- the predicate, hook and collection field;
- the per-row worker in the bulk create path;
- the worker in the edit form and action for `OTHER`;
- the dashboard filter.

**Out of scope:**

- a breakdown table;
- a worker on other types;
- draft prefill (EX-1004);
- backfill;
- the otherCategory „Opcjonalnie” drift;
- a migration.

## Phases at a Glance

| Phase                          | What it delivers                               | Key risk                                                     |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| 1. Predicate + server write    | Hook keeps an `OTHER` worker; bulk takes one per row | The hook still nulling it hides behind a success result      |
| 2. Per-row worker in the form  | Picker per row for „Inny wydatek”              | An old recovery snapshot fails to parse without `.catch('')` |
| 3. Edit `OTHER` worker         | Set/change/clear after save                    | A PAYOUT worker becoming editable through the same key       |
| 4. Dashboard filter            | „Pracownik” on `/`                             | —                                                            |

**Prerequisites:** none (no migration).
**Estimated effort:** ~1 session.

## Open Risks & Assumptions

- `payload.update` in `updateTransferAction` relies on the Local API default `overrideAccess: true`
  to bypass the field's `access.update`. Phase 1 relaxes that access for `OTHER` anyway.

## Success Criteria (Summary)

- „Inny wydatek” + „narzędzia” + Pracownik X on `/` lists X's purchases, and „Suma” gives their total.
- A wrong or missing worker on an old row is fixed from the edit dialog.
- „Pozostało do wypłaty” and marża are identical before and after.
