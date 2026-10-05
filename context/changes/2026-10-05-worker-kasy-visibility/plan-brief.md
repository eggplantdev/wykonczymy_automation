# Worker's Kasy Visibility — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-kasy-visibility/plan.md`

## What & Why

EX-960. A worker goes to the Kosz together with the kasy he owns (EX-918), but `/pracownicy` shows only
„Domyślna kasa”. So „Do kosza” moves kasy nobody saw coming. This change shows how many kasy each worker
owns, and lists them, with links, on his page.

## Starting Point

The listing already computes each worker's owned kasy names (`pracownicy/page.tsx:31`), but only for the
trash dialog. `fetchReferenceData` already separates live kasy from trashed ones, so no new data is
needed.

## Desired End State

`/pracownicy` has a sortable „Kasy” column: the count, with the names on hover. `/pracownicy/[id]` has
a „Kasy” section: every owned kasa linking to `/kasa/[id]`, with „nieaktywna” on inactive ones and an
empty state when there are none.

## Key Decisions Made

| Decision                | Choice                        | Why (1 sentence)                                                                               |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Which kasy count        | Live only, inactive included  | Exactly the set „Do kosza” takes along and the trash dialog names.                             |
| Count links to `/kasy`? | No                            | Its owner filter is client state with no URL param; the worker-page list answers „which kasy”. |
| Data source             | Existing `fetchReferenceData` | It is already loaded on both pages; no new query.                                              |
| Owner filter            | One helper `ownedRegisters`   | The listing and the worker page must agree on the set.                                         |
| Tests                   | None beyond typecheck         | The helper is a one-line filter; the live/trashed rule is `splitTrashed`'s, already specced.   |

## Scope

**In scope:** „Kasy” count column; worker-page „Kasy” section with links and the „nieaktywna” label; a
shared owner-filter helper.

**Out of scope:** trashed kasy, balances in the section, a filtered `/kasy` link, any query or schema
change.

## Phases at a Glance

| Phase                            | What it delivers                    | Key risk                             |
| -------------------------------- | ----------------------------------- | ------------------------------------ |
| 1. „Kasy” count on `/pracownicy` | Helper + sortable count column      | Count drifting from the trash dialog |
| 2. „Kasy” section on worker page | Linked list with „nieaktywna” label | None of note                         |

**Prerequisites:** none. **Estimated effort:** well under one session; 2 new files, 3 edited.

## Open Risks & Assumptions

- Verified: the trash action takes every untrashed owned kasa, whatever its `active` flag
  (`src/lib/db/worker-trash.ts:53`). If that set ever narrows, `ownedRegisters` must follow it.

## Success Criteria (Summary)

- For any worker, the listing count equals the number of kasy the „Do kosza” dialog names.
- From a worker's page, every kasa he owns is one click away.
