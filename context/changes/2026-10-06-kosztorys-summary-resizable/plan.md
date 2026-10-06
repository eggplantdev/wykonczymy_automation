# Draggable Podsumowanie Panel Height Implementation Plan

## Overview

The kosztorys editor's „Podsumowanie" panel is binary today — folded, or a full-height overlay over
the grid. This change lets the owner drag its top edge to any height in between, so part of the
kosztorys and part of the summary are on screen at once. Below full height the screen **splits**:
the grid shrinks so its last rows scroll above the panel. At full height the panel is the overlay it
is today.

A working spike of exactly this is already in the worktree (uncommitted). This plan hardens it — it
does not redesign it.

## Current State Analysis

- `TotalsPanelOverlay` (`src/components/kosztorys/summary/totals-panel-overlay.tsx`) on `staging` is
  a Radix `Collapsible.Root`, `absolute inset-x-0 bottom-0 z-20`, toggling `h-0` ↔
  `data-[state=open]:h-full` with a `transition-[height]`. It has no chrome; the only opener is
  `KosztorysTotalsPanelToggle` (owner toolbar + client view header).
- Open/closed persists in localStorage via `useTotalsPanelOpen` → `usePersistedFlag`
  (`src/hooks/use-persisted-enum.ts`), two keys (rows / empty kosztorys).
- The grid's `height` is NOT its container's: `useElementHeight` (`src/hooks/use-element-height.ts`)
  measures `window.innerHeight − rect.top − 8`, on mount and window resize only — a ResizeObserver
  looped with datasheet-grid's own resize detector (lesson „react-datasheet-grid in a flex container
  flickers"). So a shrinking container never shrinks the grid; the split has to subtract the panel
  from the grid's `height` explicitly.
- The panel content already copes with any height: pinned view-toggle bar + `SummaryScrollRegion`
  (`flex-1 overflow-y-auto`) in `summary-panel-content.tsx`.
- The sidebar's collapse handle is a pill astride its divider (`src/components/nav/sidebar.tsx`),
  `z-40` on the `<aside>` because the grid's frozen columns paint at `z-30`.

## Desired End State

- An open panel shows the sidebar's pill, horizontal, astride its top edge. Dragging it resizes the
  panel; the grid follows once on release. A press that doesn't move folds the panel.
- Release below 15 % of the grid area folds the panel (its height is kept for the next open); at or
  above 90 % it snaps to full height. In between the screen splits: grid on top, panel below, flush
  against each other with no gap.
- The height persists per browser as a fraction under `table-columns:kosztorys-totals-height`,
  shared by every kosztorys (empty or not). Default `1` — nobody's screen changes until they drag.
- The client view inherits the same behaviour (same component).
- The „Podsumowanie" toolbar button still opens/closes, restoring the last height.

### Key Discoveries:

- `useElementHeight` is viewport-anchored, no ResizeObserver (`src/hooks/use-element-height.ts:5-11`)
  — the grid height is the only lever, which makes the split deterministic.
- The panel mount condition `!worker && !pastVersion && (!preview || subtotals.length > 0)`
  (`kosztorys-editor-body.tsx`, the `KosztorysTotalsPanel` mount) must be shared by the grid-height
  computation, or the grid shrinks for a panel that isn't mounted.
- `RowResizeHandle` (`src/components/ui/datasheet-grid/row-resize-handle.tsx`) is the repo's drag
  pattern: pointer capture, `abortDrag` on cancel / lost capture, "a press that went nowhere is a
  click".
- `usePersistedEnum` store fans every write to all subscribers; a number snapshot is a primitive, so
  `useSyncExternalStore` stays stable.
- `Number('')` is `0` — a naive numeric read turns an empty/garbled entry into a zero-height open
  panel.

## What We're NOT Doing

- No live grid resize during the drag (re-virtualizing 1000+ rows per pointermove). Accepted cost: a blank band between grid and panel while dragging the panel down, and for the 200ms an open slides in.
- No per-kosztorys or per-audience height; no DB storage — it is a screen preference, layout only.
- No keyboard resizing of the separator.
- No change to the investment page's summary (it mounts `SummaryPanelContent` without the overlay).
- No change to `useElementHeight` or the grid's container layout.
- No DOM spec of the drag gesture (jsdom has no `setPointerCapture` / layout) — the gesture is a
  manual check, with its E2E deferred to the `e2e-backlog`.

## Implementation Approach

Keep the panel absolutely positioned (no flex-track rewrite). Express the split as one number — the
grid's height beside the panel — computed by a pure helper both sides read: the grid passes it as
`height`, and the panel positions its **top edge** at it (`top: <px>; bottom: 0`) rather than
setting a height. Positioning by the top edge absorbs `useElementHeight`'s 8px gap for free: the
panel fills from the grid's bottom edge to the container's bottom, whatever the container measures.
Full height is `top: 0`; closed is `top: 100%`; the transition moves to `top`.

## Critical Implementation Details

- **Drag state lives only in the overlay.** During a drag the overlay renders from a local fraction;
  only release writes the persisted fraction, so the body (and the grid) re-render once. Read the
  final fraction from the drag ref, not from React state captured in the `pointerup` closure.
- **Stacking.** The pill overhangs the panel's top edge into the grid, so the Root must drop
  `overflow-hidden` (the `Collapsible.Content` keeps it and still clips the summary) and sit at
  `z-40`, above the frozen columns' `z-30` — the same reason the sidebar is `z-40`.

## Phase 1: Geometry and persisted height

### Overview

Every figure the split depends on, as React-free helpers plus the persisted-fraction hook — the
cheapest layer to test.

### Changes Required:

#### 1. Panel geometry helpers

**File**: `src/lib/kosztorys/totals-panel-height.ts` (new — spike version exists)

**Intent**: Own the snap thresholds and the px arithmetic so the grid and the panel can never
disagree by a rounding.

**Contract**:
- `FULL_PANEL_FRACTION = 1`; private `CLOSE_BELOW = 0.15`, `FULL_SNAP = 0.9`.
- `snapPanelFraction(fraction): { open: false } | { open: true; fraction }` — `< 0.15` folds,
  `≥ 0.9` → `1`, else unchanged.
- `clampFraction(fraction)` → `[0, 1]`.
- `gridHeightBesidePanel(gridHeight, { open, fraction })` — `gridHeight` when closed or at full;
  otherwise `gridHeight − round(fraction × gridHeight)`.
- `isStoredPanelFraction(value)` — true only for a finite number in `[0.15, 1]`; the hook uses it to
  reject anything snapping could never have written.
- Replace the spike's `panelHeightPx` with whatever the overlay's `top` needs; no export without a
  reader.

#### 2. Persisted number in the shared store

**File**: `src/hooks/use-persisted-enum.ts`

**Intent**: A numeric sibling of `usePersistedEnum` on the same listener set, so a write from the
overlay re-renders the body's reader in the same tab.

**Contract**: `usePersistedNumber(storageKey, fallback, isValid: (value: number) => boolean):
[number, (next: number) => void]`. A missing, empty, non-numeric or `!isValid` entry reads as
`fallback` (guards the `Number('') === 0` trap). `isValid` must be a module-level function (stable
identity for `getSnapshot`).

#### 3. Height hook

**File**: `src/components/kosztorys/summary/hooks/use-totals-panel-height.ts` (new — spike exists)

**Intent**: The one reader/writer of the fraction, shared by the overlay and the body.

**Contract**: `useTotalsPanelHeight(): [number, (fraction: number) => void]`, key
`table-columns:kosztorys-totals-height`, fallback `FULL_PANEL_FRACTION`, validator
`isStoredPanelFraction`. One key for every kosztorys.

### Success Criteria:

#### Automated Verification:

- Helper spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/totals-panel-height.test.ts`
  — snap boundaries (0.149 / 0.15 / 0.899 / 0.9), grid height at closed / full / split, rounding
  (grid + panel cover the area exactly), `isStoredPanelFraction` on `0`, `0.15`, `1`, `1.01`, `NaN`.
- Hook spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/hooks/use-totals-panel-height.test.tsx`
  — defaults to full; a write persists and reads back; `''`, `'abc'`, `'0'`, `'5'` in storage read
  as full; a write from one hook instance re-renders another.

#### Manual Verification:

- None — this phase has no UI.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Pill handle and split layout

### Overview

Wire the geometry into the UI: the sidebar's pill becomes a shared primitive, the panel gets the drag
handle, the grid gets its reduced height.

### Changes Required:

#### 1. Shared edge pill

**File**: `src/components/ui/edge-handle-pill.tsx` (new — spike exists); `src/components/nav/sidebar.tsx`

**Intent**: One pill for both dividers, so the panel's handle reads as the same affordance as the
sidebar's.

**Contract**: `EdgeHandlePill({ orientation: 'vertical' | 'horizontal', children })` — the visible
pill only; hover keys off the caller's `group`. Sidebar renders `orientation="vertical"` with no
visual change.

#### 2. Draggable panel

**File**: `src/components/kosztorys/summary/totals-panel-overlay.tsx`;
`src/components/kosztorys/summary/kosztorys-totals-panel.tsx`

**Intent**: Pill astride the open panel's top edge; drag resizes the panel live, release snaps and
persists; a press without movement folds the panel. Position by top edge so the panel meets the grid
exactly.

**Contract**:
- New prop `availableHeight: number` (the grid's measured `gridHeight`) on both components.
- Root: `absolute inset-x-0 bottom-0 z-40`, no `overflow-hidden`; `style.top` = `0` at full,
  `100%` when closed, else the grid's height beside the panel (from the drag fraction while
  dragging). `transition-[top]` only when not dragging.
- Handle: `role="separator"`, `aria-orientation="horizontal"`, `-top-3` hit strip `h-6`,
  `cursor-row-resize touch-none`, rendered only while open, `ChevronDown` in a horizontal
  `EdgeHandlePill`. Pointer down/move/up/cancel/lost-capture per the `RowResizeHandle` pattern.
- On release: no movement → `setOpen(false)`; else `snapPanelFraction` → persist fraction when it
  stays open, then `setOpen(snap.open)`.

#### 3. Grid height beside the panel

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: The grid gives up exactly the panel's share, so its last rows scroll above the panel.

**Contract**: hoist the mount condition to `hasTotalsPanel`; `gridHeightBesideTotals =
hasTotalsPanel ? gridHeightBesidePanel(gridHeight, { open, fraction }) : gridHeight` (open from
`useTotalsPanelOpen(subtotals.length > 0)`, fraction from `useTotalsPanelHeight()`); grid
`height={gridHeightBesideTotals}`; panel mounted under `hasTotalsPanel` with
`availableHeight={gridHeight}`. Rewrite the mount comment — it describes the overlay-only design.

### Success Criteria:

#### Automated Verification:

- Existing open-flag spec still passes: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/hooks/use-totals-panel-open.test.tsx`
- Existing sidebar spec still passes: `pnpm exec vitest run src/__tests__/components/nav/sidebar.test.tsx`

#### Manual Verification:

Setup: owner login on local dev (`context/reference/manual-verification.md`), an investment whose
kosztorys has enough rows to scroll (e.g. the `seed-kosztorys.ts` one).

- Sidebar pill looks and behaves exactly as before (collapse/expand, hover grow).
- Open „Podsumowanie" → pill sits astride the panel's top edge, visible above the frozen columns.
- Drag the pill to ~half: panel follows the cursor; on release the grid shrinks, grid and panel meet
  with no gap or overlap, and the last kosztorys row is reachable by scrolling above the panel.
- Release below ~15 % → panel folds; the toolbar button reopens it at the previous height.
- Release above ~90 % → snaps to full height; grid scroll position is unchanged after folding again.
- Click the pill without moving → panel folds.
- Reload the page → the chosen height is restored; a different kosztorys opens at the same height.
- At ~20 % height the summary's view toggle bar still fits and its content scrolls.
- Client view link (`/oferta/…` share of the same kosztorys) → same pill and split behave the same.
- Resize the browser window with a split panel → grid and panel stay flush.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `src/__tests__/lib/kosztorys/totals-panel-height.test.ts` — snap thresholds at their exact
  boundaries, split arithmetic summing to the area, stored-value validation.

### Integration Tests:

- `renderHook` spec for `useTotalsPanelHeight` (dom project) — persistence, garbage entries,
  cross-instance notification. Pattern: `use-totals-panel-open.test.tsx`.

### Manual Testing Steps:

See Phase 2 Manual Verification. The drag gesture's browser-level E2E is deferred to a Linear issue
labelled `e2e-backlog` (project „Wykonczymy"), filed at the review gate.

## Performance Considerations

The grid re-virtualizes once per drag (on release) and once per open/close — same cost as today's
toggle. During the drag only the panel's `top` changes.

## Whole-tree Gate

Run **once**, after the final phase. Worktree: build with `--webpack` (lesson „In a git worktree with
symlinked node_modules…").

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm exec next build --webpack`

## References

- Change notes + spike summary: `context/changes/2026-10-06-kosztorys-summary-resizable/change.md`
- Drag pattern: `src/components/ui/datasheet-grid/row-resize-handle.tsx`
- Sidebar pill: `src/components/nav/sidebar.tsx`
- Lessons: „react-datasheet-grid in a flex container flickers", „A per-browser preference stops being
  a preference the moment a second audience reads the same surface" (does not bite: height is layout,
  not content)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Geometry and persisted height

#### Automated

- [x] 1.1 Helper spec passes: `totals-panel-height.test.ts` — f8141bc6
- [x] 1.2 Hook spec passes: `use-totals-panel-height.test.tsx` — f8141bc6

### Phase 2: Pill handle and split layout

#### Automated

- [x] 2.1 Existing open-flag spec still passes: `use-totals-panel-open.test.tsx` — ea766d70
- [x] 2.2 Existing sidebar spec still passes: `sidebar.test.tsx` — ea766d70
