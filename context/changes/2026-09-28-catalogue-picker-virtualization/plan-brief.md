# Catalogue picker virtualization — Plan Brief

> Full plan: `context/changes/2026-09-28-catalogue-picker-virtualization/plan.md`

## What & Why

„Dodaj pracę z katalogu" renders the whole cennik (561 prac) into the DOM. On a 4×-throttled CPU that
freezes the page for 0.4–0.7 s on open, on „Ukryj już dodane" and on every search. Turning on the
table's existing virtualization measured 4–10× faster, but broke the dialog's layout, so this change
lands the speed-up with the layout intact (EX-860).

## Starting Point

`DataTable` already has opt-in virtualization, used by two summary tables. Its virtualized body assumes
a fixed row height and never measures, sizes columns from `getSize()` (unsized = 150 px each), and
takes a fixed px height. None of the three fits the picker.

## Desired End State

The picker draws only the rows in view: „Opis pracy" takes the width the narrow columns leave, wrapped
rows scroll without jumps, the list caps at 55vh and shrinks for a short search result. At 4× CPU,
open / show-all / keystroke land near 107 / 57 / 68 ms instead of 412 / 662 / 641 ms.

## Key Decisions Made

| Decision            | Choice                                                | Why                                                                            |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Row measurement     | On for every virtualized table                        | One code path; removes the silent drift the materials table's comment warns of |
| Column widths       | Narrow columns sized, „Opis pracy" `fill`s the rest   | The opis is what a praca is picked by; its `size` is its floor                 |
| List height         | `max-h-[55vh]` class on the scroll container          | Same cap as today, and it collapses to a short result instead of an empty box  |
| Summary tables' API | Unchanged (`virtualContainerHeight` px stays)         | Their height is computed at runtime; a class can't express it                  |
| E2E                 | Find the row through the szukajka                     | A row outside the window is absent, which would make the hidden-check vacuous  |
| Regression guard    | DOM spec: a few hundred items render a bounded window | Without it, dropping the flag in a refactor passes every spec                  |

## Scope

**In scope:** shared virtualized body (measure, fill column, container class); picker sizes and
virtualization; dialog DOM guard; E2E search step; stale „~950" comment; re-measurement.

**Out of scope:** /katalog-prac, `catalogue-diff-table`, sheet compare/report dialogs, sticky header.

## Architecture / Approach

`VirtualizedTableBody` registers every rendered `<tr>` with `virtualizer.measureElement` (via two
optional pass-through props on `DataTableRow`), leaves the `<col>` of a `meta.fill` column without a
width while still counting its `size` into the table's `minWidth`, and applies a caller's class to its
scroll `<div>` instead of the px height. The picker then turns the flag on.

## Phases at a Glance

| Phase                 | What it delivers                                         | Key risk                                                |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| 1. Shared table layer | Measured rows, fill column, container class              | Summary tables change subtly — visual check owed        |
| 2. The picker         | Sized columns, virtualized list, DOM guard, E2E, comment | Sizes overflowing dialog-xl → horizontal scroll         |
| 3. Re-measure         | Numbers recorded next to the baseline                    | Different build/investment would make them incomparable |

**Prerequisites:** local docker `db`, a production build for Phase 3.
**Estimated effort:** one session.

## Open Risks & Assumptions

- `min-width` on table cells is undefined under `table-fixed`; the fill column's floor relies on the
  table's summed `minWidth` instead.
- The E2E spec is run by a human; the agent does not run E2E unprompted.

## Success Criteria (Summary)

- The picker looks as it does today, at every list length.
- At 4× CPU every measured interaction is within ~1.5× of the flag-only numbers.
- Both summary tables look and scroll as before.
