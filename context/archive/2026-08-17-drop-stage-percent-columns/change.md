---
change_id: drop-stage-percent-columns
title: Drop the per-etap „% wykonania" columns and their wiring
status: archived
created: 2026-08-17
updated: 2026-08-17
archived_at: 2026-08-17T12:02:22Z
branch: client-preview-settings
worktree: null
---

## Notes

remove the per-etap „% wykonania" columns (Etap N %) from the kosztorys editor and all their wiring

Motivation (owner): fewer columns, less logic, less bloated views — the per-etap percent axis isn't
useful enough to keep paying for.

Known wiring to unpick (first sweep, not exhaustive):

- `src/lib/kosztorys/stage-keys.ts` — `STAGE_VALUE_PERCENT_COLUMN_GROUP`, `stageValuePercentKey()`
- `src/lib/kosztorys/column-config.ts` — label, `COLUMN_PROGRESS_DISPLAY` (the whole
  values/percent progress-display axis may collapse once the percent side is gone),
  `COLUMN_LAYER`, `CLIENT_VIEW_GROUPS`
- `src/lib/kosztorys/header-tips.ts`, `src/lib/kosztorys/progress-display.ts`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`, `kosztorys-v2-column-opts.ts`
- `src/components/kosztorys/editor/hooks/use-progress-display.ts`,
  `toolbar/kosztorys-view-axis-options.tsx`, `use-kosztorys-editor.ts`
- specs: `kosztorys-progress-display.test.ts`, `kosztorys-layer.test.ts`,
  `v2-columns-readonly.test.ts`, `preview-columns.test.ts`

Scope decided by the owner, 2026-08-17:

1. **The `values | percent` progress-display axis goes with the columns.** Degenerate once the
   percent column is gone, and its one surviving capability is duplicated by the column picker and
   by `layer: 'work'`. Deletes `progress-display.ts`, `use-progress-display.ts`, and the „Etapy"
   toolbar section.
2. **The client preview losing the column is accepted** — `PREVIEW_VISIBLE_COLUMNS` shrinks by one
   and the client-view settings dialog loses a tick.
3. **`donePercent` STAYS** („% wykonania (względem przedmiaru)", the row-level column). Re-opened and
   re-confirmed on 2026-08-17 against the argument that the Podsumowanie already shows a percent: it
   does not show the same figure — „Postęp prac" is value-weighted over the whole dataset, while the
   column is quantity-weighted per row, so the summary cannot say *which* position is lagging. It is
   also the only display surface for the przedmiar-overrun red-cell signal (`hasStagesOverPlanned`).

Deletion trap (from research): the axis maps fail open, so deleting a member's map entries while its
predicate survives leaves an always-true conjunct in the `keep()` chain rather than an error. Before
deleting a member of an enum axis, check the axis's whole domain and remove the predicate with it.
