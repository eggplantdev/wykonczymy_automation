# Column width command — Plan Brief

> Full plan: `context/changes/2026-10-22-column-width-command/plan.md`
> Research: `context/changes/2026-10-22-column-width-command/research.md`
> Spike: `context/changes/2026-10-22-column-width-command/spike.md`

## What & Why

Owners resize columns the Excel/Sheets way — select several, type one width. The kosztorys editor
only has a per-column drag handle, so evening out a sheet means dragging every column by eye.

## Starting Point

A spike proved option C: the grid's own column selection survives opening a column header menu, so
the menu can offer one width for the whole selection. It runs uncommitted on `staging`.

## Desired End State

Every resizable column's header menu offers „Szerokość kolumn (N)…" and a reset for the selected span;
„Opcje" offers the same for all visible columns. Typed widths clamp to 40 px and survive a reload.

## Key Decisions Made

| Decision                | Choice                                            | Why                                                                  | Source   |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Where the command lives | Column header menu                                | Opening it keeps the grid selection alive; a toolbar click clears it | Research |
| Which columns           | Column span of the selection, rows ignored        | Excel does the same; Shift+click yields row 0 only                   | Research |
| Shift+click on a label  | Extends the selection, no menu                    | Labels cover most of the header, the empty strip is small            | Spike    |
| Whole sheet             | „Szerokość wszystkich kolumn…" + reset in „Opcje" | Owner asked; most common case needs no selection                     | Plan     |
| Scope of a width        | Global per browser, as today                      | Existing behaviour of the drag handle                                | Research |
| Hint                    | Description on the single-column item             | Neither selection gesture is visible otherwise                       | Plan     |

## Scope

**In scope:** header-menu items, „Opcje" items, dialog, pure rules + tests, batched store write.

**Out of scope:** shortcuts, right-click menu, non-contiguous selection, per-kosztorys widths, undo.

## Phases at a Glance

| Phase                         | What it delivers                                        | Key risk                                    |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| 1. Pure rules + batched write | Tested eligibility, selection→ids, parsing; `setMany`   | Pinned vs design-fixed column misclassified |
| 2. Editor wiring              | Hook on the pure layer, „Opcje" pair, hint, dialog spec | Selection snapshot timing (proven in spike) |

**Estimated effort:** one session.

## Open Risks & Assumptions

- Widths stay global: a bulk width reshapes every kosztorys and szablon in that browser.
- Pinning „Opis prac" removes its stretch — blank space to the right, as in Excel.

## Success Criteria (Summary)

- Selecting N columns and typing one number gives all N that width.
- One click in „Opcje" evens out the whole sheet, and one click undoes it.
