---
change_id: kosztorys-section-menu-split
title: Split the ⋯ menu — section actions onto the section band, work actions onto the row
status: archived
created: 2026-09-14
updated: 2026-09-14
archived_at: 2026-09-14
branch: szablony-crud
worktree: null
---

## Notes

Splits the single ⋯ menu into two again: „Praca" (work) stays on the item row, the whole „Sekcja"
(section) group moves to the section band. Reverses `2026-07-26-kosztorys-merged-row-menu` (archive deleted 2026-09-29; git history)
(which itself reversed EX-580 p4, commit `7af257b2`).

### Why again

The 2026-07-26 merge reason was: two ⋯ in the same sticky „Akcje" column repeat the same four
ordering commands and you can't tell what they refer to. It no longer holds — the menu carries group
headers („Praca" / „Sekcja"), and the two triggers sit on **different rows** (band vs item row), so the
target is clear without a label.

A second, stronger reason: the compromise accepted then, "expand to act" — a collapsed section renders
only its band, so its own commands were unreachable. The split removes that.

> **Superseded (`1414b53d`, after the owner demo):** the explicit section labels and the „Praca" /
> „Sekcja" group headers were restored.

### Owner decisions (2026-09-14)

1. **The section ⋯ sits in the band's „Akcje" slot** — a third slot in `SectionHeaderCell` next to
   `label` / `blank`. That one cell **does not collapse the section**, it opens the menu. No
   propagation stopping: the cell simply gets no collapse handler.

   > **Superseded (`799de034`, 2026-09-15):** the band ⋯ is a neutral `text-foreground` trigger; the
   > section color stays on the dot and the rail, not on the ⋯.

2. **The „Sekcja" group leaves the row menu entirely.** Accepted side effect: with a column sort on,
   the section bands disappear from the grid, taking the only entry to section actions with them.
   Previously, under a sort, „Wstaw/Przesuń" were greyed but color and „Usuń sekcję" still worked from
   the row menu — after the change the sort has to be cleared first.

   > **Superseded:** under a section-scoped sort the bands stay visible; insert/reorder are greyed
   > via `sortActive` (`orderCommandsEnabled` in `src/lib/kosztorys/order-commands.ts`).

3. **„Wybierz pozycję z katalogu prac" → „Dodaj pracę z katalogu…", section menu only.** This action
   always targeted the section, not the item: the work lands **at the end of the section**
   (`insertCatalogueItemsAction` → `appendCatalogueItems`), which is why it alone stayed enabled under
   a sort. It stays at the end of the section — no inserting below the clicked row.
4. **„Zapisz pozycję do katalogu prac" stays on the row** — it concerns that one item.
