---
change_id: kosztorys-view-freeze-while-editing
title: Freeze the kosztorys view's rows and stage columns while the user edits
status: archived
created: 2026-10-22
updated: 2026-10-22
archived_at: 2026-10-22T16:22:57Z
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

## Closed 2026-10-22

- Rationale and release actions: `context/reference/kosztorys-editor-domain-notes.md` (the view-latch bullet).
- Full suite (`pnpm test`, e2e, build) not run at the review gate — the user deferred it; touched specs, typecheck and lint were green.
- Known gap, unchanged by this slice: `handleAppendedSections` does not `holdNewRow`, so under a search an appended section whose pozycje don't match stays hidden (it was before too).
- Review-gate refactor ideas left open on purpose: lifting the latched-id bypass out of `filterRows` / `applyRowConditions` / `stagesMatchingEngaged` into one step, and moving the stage narrowing out of `buildV2Grid` (about 10 grid specs pin its contract).
