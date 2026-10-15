# Document settings column map — Plan Brief

> Full plan: `context/changes/2026-10-15-document-settings-column-map/plan.md`

## What & Why

Investor and worker document settings store the list of hidden columns, so a column missing from a
saved list shows. Every new hidden-by-default column has needed a migration to append it to every
saved row; forgetting one shows the column to clients or workers. Storing `{ column: hidden }` and
reading an unmentioned column as its code default removes that migration for good (EX-1033).

## Starting Point

Two sanitizers read the array; three save paths write it; 36 stored rows. Everything else consumes
the resolved hidden list.

## Desired End State

A new document column starts at its code default on every saved investment and on the worker
setting, with no migration. Owners' existing choices are unchanged.

## Key Decisions Made

| Decision                         | Choice                                                         | Why                                                        |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| What changes                     | Storage format only; in-memory `hiddenColumns: string[]` stays | Dialogs, print, links untouched                            |
| Legacy rows                      | Read both formats; one data migration converts                 | Same jsonb column, no schema change                        |
| Missing key on an investment row | Code default, row still wins as a whole                        | Per-key global fallback changes nothing for a new key      |
| Migration timing                 | After the deploy                                               | Old code reads an object as „never chosen" → wider default |

## Scope

**In scope:** shared resolver/serializer, both sanitizers, three save paths, storage comments, one
data migration, the lessons.md exception.

**Out of scope:** UI, print, per-key fallback chain, schema changes.

## Phases at a Glance

| Phase                      | What it delivers                          | Key risk                                    |
| -------------------------- | ----------------------------------------- | ------------------------------------------- |
| 1. Read and write the map  | Map format live in code, array still read | A resolver bug serves a column an owner hid |
| 2. Convert the stored rows | 36 rows become maps                       | Running it before the deploy                |
| 3. Lesson                  | Disclosure exception recorded             | —                                           |

**Estimated effort:** 1–2 hours.

## Open Risks & Assumptions

- Prod migration is a human step after the deploy; until it runs, behaviour is today's.

## Success Criteria (Summary)

- A stored map that predates a column reads that column as its code default.
- Every investor and worker link shows the same columns after the migration as before.
