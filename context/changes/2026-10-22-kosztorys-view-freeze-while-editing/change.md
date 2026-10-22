---
change_id: kosztorys-view-freeze-while-editing
title: Freeze the kosztorys view's rows and stage columns while the user edits
status: implementing
created: 2026-10-22
updated: 2026-10-22
archived_at: null
branch: null
worktree: null
---

## Notes

EX-1114: one latch freezing view composition + order (sort, search, row conditions) and the stage-column set under stage problems while the user edits; recomputes only on deliberate actions

Verified 2026-10-22 against the code:

- Sort — confirmed: `buildViewRows` re-sorts on every `rows` change; the latch bypasses conditions only (`src/lib/kosztorys/row-view.ts:105-109`).
- Search — confirmed: deliberately outside the latch (`row-view.ts:89-92`).
- Stage columns under „z podziałem do poprawienia" — confirmed, but it is a COLUMN-index shift: an amount-mode split stops being scaled down once qty × cena reaches the entered amounts (`src/lib/kosztorys/stage-split.ts:37`), so the etap's column leaves the grid mid-typing. A row-order latch does not cover it — needs a stage-id latch. The other two stage conditions read only etap settings.
- Section folding — false alarm: `foldableSectionIds` only feeds the „Sekcje" menu toggles; nothing folds on its own.
- New pozycje must stay held (`holdNewRow`) once the latch freezes order as well as membership.
