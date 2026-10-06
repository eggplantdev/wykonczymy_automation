# Draggable Podsumowanie Panel Height — Plan Brief

> Full plan: `context/changes/2026-10-06-kosztorys-summary-resizable/plan.md`

## What & Why

The kosztorys editor's „Podsumowanie" panel is either folded or covers the whole grid. The owner
wants to drag it to, say, half height and see part of the kosztorys and part of the summary at once.

## Starting Point

The panel is an absolute full-height overlay toggled by a toolbar button, open/closed persisted in
localStorage. The grid's height is measured from the viewport (no ResizeObserver, on purpose), so it
never reacts to its container — the grid must be told its smaller height explicitly. A working spike
of the whole feature is already in this worktree, uncommitted.

## Desired End State

An open panel carries the sidebar's pill on its top edge. Dragging it resizes the panel; on release
the grid shrinks so its last rows scroll above the panel. Dropping near the bottom folds it, near the
top makes it full height (today's overlay). The height is remembered per browser for every kosztorys,
and the client view behaves the same.

## Key Decisions Made

| Decision          | Choice                                         | Why (1 sentence)                                                                  |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Layout            | Split: grid shrinks, panel takes the rest       | Both halves stay usable; an overlay at half height would hide grid rows.         |
| Full height       | Behaves as today's overlay, grid untouched     | Folding again returns the grid with its scroll intact.                            |
| Stored value      | Fraction of the grid area, one shared key      | Survives window resizes; an empty kosztorys needs no height of its own.           |
| Drag              | Panel follows live, grid resizes on release    | Re-virtualizing 1000+ rows per pointer move is the cost to avoid.                 |
| Snap              | < 15 % folds, ≥ 90 % goes full                  | Folding by drag and reaching full height need no pixel precision.                 |
| 8px gap           | Panel positioned by top edge, absorbs it       | Grid and panel meet exactly, whatever the container measures.                     |
| Handle            | Sidebar's pill, extracted to a shared primitive | One affordance for "this edge moves", reused as the owner asked.                 |
| Client view       | Same behaviour                                  | Height is layout only, not content the owner curates.                             |
| Tests             | Unit + renderHook; E2E to the `e2e-backlog`    | jsdom can't drive pointer capture or layout; the arithmetic is where bugs hide.  |

## Scope

**In scope:**
- Drag handle, snap, split layout, persisted fraction, shared pill (sidebar refactored onto it)

**Out of scope:**
- Live grid resize during drag, per-kosztorys height, DB storage, keyboard resizing
- The investment page's summary (no overlay there)

## Architecture / Approach

One pure helper computes the grid's height beside the panel from the measured grid height plus the
stored fraction. The editor body passes it to the grid as `height`; the overlay uses the same number
as its `top` (with `bottom: 0`), so the two can never disagree. Drag state stays local to the overlay
and is written to the shared localStorage store only on release.

## Phases at a Glance

| Phase                              | What it delivers                                       | Key risk                                                   |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| 1. Geometry and persisted height   | Snap/split helpers + `useTotalsPanelHeight`, with specs | A garbage stored value (`''` → 0) opening a zero panel      |
| 2. Pill handle and split layout    | Shared pill, draggable overlay, grid height beside it   | Pill hidden under frozen columns; grid/panel off by pixels |

**Prerequisites:** none — worktree on `staging`, spike files present.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The window-resize path depends on `useElementHeight` re-measuring; the split follows because both
  sides derive from the same number.
- The drag gesture has no automated guard until its E2E backlog issue is done.

## Success Criteria (Summary)

- Owner drags the panel to half and works in the grid and the summary at once.
- Folding, full height and the toolbar button behave as before; the height survives a reload.
