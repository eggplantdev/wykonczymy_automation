---
change_id: column-width-command
title: Excel/Sheets-style "select columns, type one width" in the kosztorys editor grid
status: archived
created: 2026-10-22
updated: 2026-10-23
archived_at: 2026-10-23T07:14:48Z
branch: null
worktree: null
---

## Notes

Owner habit from Excel / Google Sheets: select columns, type one width, every selected column takes it.
Shipped as EX-1127: the header menu of a selected column range offers „Szerokość kolumn (N)…” and a
counted „Przywróć domyślną szerokość”; „Opcje” → „Edycja” carries „Szerokość wszystkich kolumn…” and
„Przywróć domyślne szerokości”. The single-column item hints how to select several.

## Decisions

- **The command lives in the header menu, not the toolbar.** Any mousedown outside the grid clears
  dsg's selection, a toolbar click included; opening a header menu doesn't (Radix cancels the
  mousedown). The targets are snapshotted as the menu opens.
- **The selection's column span counts, its rows are ignored** — as in Excel. Shift+click on a second
  header yields row 0 only, and that still names the right columns.
- **No right-click menu**: dsg's context menu is off because the editor passes `lockRows`, and dropping
  it would bring back row insert/duplicate/delete. **No Ctrl/Cmd multi-select**: dsg keeps one rectangle.
- **A width stays global per browser** (one id across every kosztorys and szablon), like drag-resize.
  No undo — the reset items are the way back. No maximum, like drag-resize.
- **Typed widths clamp to the drag minimum (40 px)**, not to a column's design minWidth.
- **Open, not decided:** the command is off in read-only while drag-resize works there — a width is a
  per-viewer preference, so enabling it is likely right, but it changes what a read-only viewer can do.

## Untested paths

Shift+pointerdown passing through to dsg and the selection snapshot on menu open have no automated
test (jsdom can't drive dsg's pointer selection); the EX-1127 manual checks cover them.
