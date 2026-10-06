---
change_id: kosztorys-summary-resizable
title: Draggable height for the kosztorys Podsumowanie panel (grid / summary split)
status: archived
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06T09:04:20Z
branch: kosztorys-summary-resizable
worktree: .claude/worktrees/kosztorys-summary-resizable
---

## Notes

przeciągana wysokość panelu Podsumowanie w edytorze kosztorysu (podział ekranu grid / podsumowanie), spike już w drzewie roboczym; następny krok: /10x-plan

### Spike (uncommitted, in the working tree)

- Split, not overlay: below full height the grid's `height` shrinks by the panel's px
  (`gridHeightBesidePanel`), so the last rows scroll above the panel. `useElementHeight` measures
  viewport-to-bottom, not the container (no ResizeObserver — loops with datasheet-grid), so the grid
  never adapts on its own; subtracting the panel explicitly is the mechanism.
- At full height (fraction 1) the panel stays the old overlay at `100%`; the grid keeps its whole
  height and scroll underneath.
- Height persisted as a fraction under `table-columns:kosztorys-totals-height` (default 1 = today's
  behaviour); new `usePersistedNumber` on the `use-persisted-enum` store.
- Drag moves only the panel; the grid resizes once on release (no per-pointermove re-virtualization).
  Snap: < 0.15 closes, ≥ 0.9 → full. A press without movement folds the panel (sidebar-pill click).
- Handle = the sidebar's divider pill, extracted to `ui/edge-handle-pill.tsx` and reused
  horizontally astride the panel's top edge; panel Root raised to z-40 and lost `overflow-hidden` so
  the overhanging half isn't clipped / hidden under the frozen columns (z-30).

Files: `lib/kosztorys/totals-panel-height.ts`, `summary/hooks/use-totals-panel-height.ts`,
`hooks/use-persisted-enum.ts`, `summary/totals-panel-overlay.tsx`, `summary/kosztorys-totals-panel.tsx`,
`ui/edge-handle-pill.tsx`, `nav/sidebar.tsx`, `editor/kosztorys-editor-body.tsx` (3 small edits; that
file also carries another session's uncommitted diff).

Open for the plan: ~8px gap between grid and panel (`useElementHeight` gap), blank strip while
dragging the panel down until release, minimum usable height near the 0.15 threshold, whether the
client view should get the handle, tests (snap/px helpers unit; hook persistence `renderHook`).
