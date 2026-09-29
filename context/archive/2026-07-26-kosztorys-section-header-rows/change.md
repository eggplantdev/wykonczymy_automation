---
change_id: kosztorys-section-header-rows
title: Group header row per section in the kosztorys grid, replacing the repeated „Sekcja" column
status: archived
created: 2026-07-26
updated: 2026-07-26
archived_at: 2026-07-26T12:33:20Z
branch: kosztorys-section-header-rows
worktree: ../wykonczymy-worktrees/kosztorys-section-header-rows
---

## Notes

Replace the repeated „Sekcja" column with a group header row per section (colour dot, name, item
count, section subtotal) in the kosztorys v2 grid.

Owner's ask, verbatim: "try the sections remake / divider with total for section wouldn't be bad".

Precursor, authored first but shipping **on this branch** (commit `8e131593`, plus
`src/scripts/seed-kosztorys-bands.ts` as the E2E fixture): sections are separated in the grid by a
colour spine in the gutter column + a 2px divider in the section's hue above its first row, and the
auto-assigned palette order now spreads hues so neighbouring sections never share one. It belongs to
no phase in `plan.md` — the band inherits both cues, so the two land together or not at all.

## Shipped decisions worth keeping

- **Rename gesture** is focus-to-edit (`useInlineRename`, now `editor/hooks/use-inline-rename.ts`),
  not double-click. Focusing a name and leaving without typing does not write.
- **Collapse click target is the chevron only**, not the whole label block: in editor mode the rename
  input owns the rest of the block, and a click that both focuses the input and folds the section
  reads as a bug.
