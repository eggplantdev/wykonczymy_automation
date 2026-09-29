---
change_id: kosztorys-column-value-single-source
title: One value function per computed kosztorys column, shared by cell and sort (EX-894)
status: implemented
created: 2026-09-29
updated: 2026-09-29
archived_at: null
branch: kosztorys-column-value-single-source
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/kosztorys-column-value-single-source
---

## Notes

EX-894: one value function per computed kosztorys column, shared by the grid cell and the sort key
(and anything else that recomputes a column's figure), so sort order can never drift from the
displayed number again. Fixes `plannedNet` / `donePercent` / `remaining` sorting by the active view
while their cells read `'client'` (owner ruling 2026-09-23, commit `3400f9b2`, made those columns
visible in the crew views without re-pinning their sort keys). Second drift of this kind after EX-487.

User asked for manual checks alongside the refactor.
