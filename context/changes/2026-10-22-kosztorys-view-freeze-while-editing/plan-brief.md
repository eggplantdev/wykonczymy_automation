# Freeze the kosztorys view while editing — Plan Brief

> Full plan: `context/changes/2026-10-22-kosztorys-view-freeze-while-editing/plan.md`

## What & Why

EX-1114. Under a sort, a search phrase or a condition, typing into a cell can move or remove the
pozycja (or the etap's column) under the cursor; the grid keeps the cursor by index, so the next digit
lands in someone else's row. Three point fixes so far; this replaces them with one mechanism.

## Starting Point

A condition-only latch holds rendered row ids until „Problemy"/„Filtry" reopens. Sort, search and stage
columns have no freeze.

## Desired End State

While sort / search / a condition is active, the view built at the last deliberate action stays put:
no row leaves, no row moves, no stage column leaves. New pozycje join at the end of their sekcja (or of
the list under a global sort).

## Key Decisions Made

| Decision           | Choice                                                        | Why                                        |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------ |
| How to re-sort     | Pick the sort item again (even the active one)                | Already a fresh object per pick; no new UI |
| Search             | Latched rows bypass the phrase; editing the phrase recomputes | Same rule as conditions                    |
| Stage columns      | Same latch, stage ids beside row ids                          | One key, one release                       |
| Price-view switch  | Recomputes                                                    | Changes the sort values; deliberate        |
| „Zapisz kolejność" | Recomputes in the same handler                                | Otherwise saved ≠ shown                    |
| Section folding    | Untouched                                                     | Checked: never folds on its own            |

## Scope

**In scope:** `buildViewRows`, `filterRows`, `stagesMatchingEngaged`, the latch hook (renamed
`useViewLatch`), editor/grid wiring, „Zapisz kolejność".

**Out of scope:** a stale-order indicator, list tables, the grid's index-based cursor.

## Phases at a Glance

| Phase            | What it delivers                                                         | Key risk                                          |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| 1. Pure layer    | Freeze honoured in `buildViewRows` / `stagesMatchingEngaged`, test-first | Unranked-row placement per sort scope             |
| 2. Editor wiring | One keyed latch; grid + „Zapisz kolejność" wired                         | Key misses a deliberate action → view stuck stale |

**Estimated effort:** one session.

## Open Risks & Assumptions

- A sorted column now shows a stale order after edits until the sort is re-picked — accepted by the
  issue („przeliczają się dopiero przy świadomej akcji").
