# Column width command — Implementation Plan

## Overview

Owners set column widths the Excel/Sheets way: select columns, type one width, every selected column
takes it. The kosztorys v2 editor gets that through the column header menu, plus a whole-sheet variant
in „Opcje". Built on the spike (`spike.md`), which proved the selection seam works.

## Current State Analysis

- The spike's code is applied uncommitted on `staging` (commit `aa595b47c` on `spike/column-width-command`
  is the reference copy). It works in the browser for single, dragged, Shift+clicked and cell-range
  selections, reset and clamping (`spike.md` → „Verified in the browser").
- What the spike left rough:
  - eligibility, selection→ids and width parsing live inline in a hook and a dialog — untested;
  - `useColumnWidthCommand` mixes the pure resolution with React state;
  - the „Szerokość wszystkich kolumn…" item in „Opcje" was added ad hoc, with no reset counterpart;
  - nothing tells the user that several columns can be selected.

## Desired End State

- Header menu of every resizable column ends with „Szerokość kolumn (N)…" / „Szerokość kolumny…" and
  „Przywróć domyślną szerokość", acting on the selected column span when it covers the clicked column,
  else on that column alone. The single-column item carries a one-line hint on how to select several.
- „Opcje" → „Edycja" has „Szerokość wszystkich kolumn…" and „Przywróć domyślne szerokości", acting on
  every visible resizable column.
- One dialog, Enter applies, comma decimal accepted, below 40 px clamps to 40, prefilled when all
  targets share a stored width.
- None of it appears in the investor preview, the worker report or a read-only editor.
- The pure rules are unit-tested; the store's batched write is tested.

### Key Discoveries:

- dsg selection read: `datasheetRef.current.selection` (`min.col..max.col` index into `gridColumns`),
  alive when a header menu opens because Radix cancels the trigger's pointerdown (`research.md`).
- Context consumers only: the header-menu extension and the „Opcje" open callback are read by the
  `HeaderMenu` instances and one menu item, never by grid cells — a new value re-renders ~20 headers,
  not the sheet. No hand memo needed.
- `withResize` (`grid/column-sizing.tsx:14`) skips no-id and fixed (`minWidth === maxWidth`) columns,
  but a pinned column also ends up `minWidth === maxWidth` — eligibility on rendered columns must
  treat "fixed but equal to its stored width" as resizable. `layerGap` is drag-resizable but must not
  take a bulk width.
- Width keys are global across kosztorysy and szablony (`hooks/use-column-widths.ts`) — unchanged here.

## What We're NOT Doing

- No keyboard shortcut, no right-click menu (dsg's is disabled by `lockRows`).
- No non-contiguous (Ctrl/Cmd) multi-select — dsg has one rectangle.
- No per-kosztorys or per-workshop width scope.
- No undo for width changes (the reset items are the way back).

## Implementation Approach

Move the rules React doesn't need into `src/lib/kosztorys/column-width-targets.ts` (tested in node),
keep `ColumnWidthHost` as the thin React layer, keep `ui/` domain-agnostic (extension slot +
column-id context only). Reuse the existing `ReorderOpenContext` pattern for the „Opcje" entry.

## Phase 1: Pure rules + batched store write

### Changes Required:

#### 1. Column width targets

**File**: `src/lib/kosztorys/column-width-targets.ts`

**Intent**: One home for "which columns take a width" and "what did the user type".

**Contract**:

- `resizableColumnIds(columns, widths): string[]` — visible ids that may take a width: has an id, not
  `layerGap`/`actions`, and not design-fixed (`minWidth === maxWidth` unless it equals the stored width).
- `selectionTargetIds(columns, widths, selection, clickedId): string[]` — the resizable ids in
  `columns[min.col..max.col]` when that span includes `clickedId`, else `[clickedId]` if resizable.
- `parseColumnWidth(text, minPx): number | undefined` (own file, `lib/kosztorys/parse-column-width.ts`,
  on `parseDecimalInput`) — trims, accepts a comma decimal, rejects empty/non-finite/≤0, rounds,
  clamps to `minPx` (the dialog passes `RESIZE_MIN_PX`).

#### 2. Batched write

**File**: `src/hooks/create-json-map-store.ts`, `src/components/kosztorys/editor/hooks/use-column-widths.ts`

**Intent**: N ids in one write and one notify (one grid re-layout).

**Contract**: `JsonMapStoreT.setMany(entries)`; `useColumnWidths().setWidths(ids, width)`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/column-width-targets.test.ts`
- `pnpm exec vitest run src/__tests__/hooks/create-json-map-store.test.ts`

#### Manual Verification:

- (covered by Phase 2)

---

## Phase 2: Editor wiring

### Changes Required:

#### 1. Header menu seam (ui/)

**File**: `src/components/ui/datasheet-grid/header-menu-extension.tsx`, `header-menu.tsx`,
`column-resize-handle.tsx`

**Intent**: Keep the spike's seam — column id from `ResizableHeader`, optional `{ onOpen, items }`
extension, Shift+pointerdown on the label passes through to the grid.

#### 2. Command host

**File**: `src/components/kosztorys/editor/actions/column-width-host.tsx`,
`actions/column-width-header-items.tsx`

**Intent**: React state only — the header menu snapshots its targets on open, the host owns the dialog
state and provides both contexts, apply/reset — delegating every rule to Phase 1. (Replaced a
`.tsx` hook during the review gate, so a menu open no longer re-renders the editor body.)

**Contract**: `<ColumnWidthHost datasheetRef columns enabled>` provides `HeaderMenuExtensionContext`
(`{ targetIds, items }`) and `ColumnWidthAllContext`, and renders the dialog. Both header items show
the count when it is >1. The single-column item gets the description „Zaznacz kilka kolumn (przeciągnij po nagłówkach lub
Shift+klik), żeby ustawić je naraz."

#### 3. „Opcje" entries

**File**: `src/components/kosztorys/editor/actions/column-width-open.ts`, `column-width-action.tsx`,
`toolbar/menus/kosztorys-actions-menu.tsx`, `kosztorys-editor-body.tsx`

**Intent**: Context carrying `{ openAll, resetAll }` (undefined when the command is off), rendered as
„Szerokość wszystkich kolumn…" and „Przywróć domyślne szerokości" under „Edycja".

#### 4. Dialog

**File**: `src/components/kosztorys/editor/dialogs/column-width-dialog.tsx`

**Intent**: Use `parseColumnWidth`; behaviour unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/column-width-dialog.test.tsx`
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.test.tsx`

#### Manual Verification:

- Editor: drag along the empty strip above 3 column names, click one of their names →
  „Szerokość kolumn (3)…" → 100 + Enter: all three are 100 px, also after a reload.
- Shift+click on another column's name extends the selection instead of opening the menu.
- A cell range across 4 columns → that column's menu → „Przywróć domyślną szerokość": only those 4 reset.
- „Opcje" → „Szerokość wszystkich kolumn…" → 120: every visible column except the action column and
  the gap after the last column is 120 px; „Przywróć domyślne szerokości" brings them all back.
- A stage column (Etap) takes a typed width like any other column.
- With „Dopasuj wysokość wierszy" on, narrowing „Opis prac" makes rows taller at once.
- Typing 10 gives 40 px; typing „120,6" gives 121 px.
- Investor preview and worker report: no width items in column menus or in „Opcje".

---

## Testing Strategy

### Unit Tests:

- `resizableColumnIds`: drops `layerGap`, `actions`, id-less and design-fixed columns; keeps a pinned one.
- `selectionTargetIds`: span covering the clicked column → its resizable ids; clicked outside → just
  it; no selection → just it; clicked non-resizable → `[]`.
- `parseColumnWidth`: comma, whitespace, rounding, clamp, empty, garbage, zero/negative.
- `setMany`: one write holding all keys, one notify.

### DOM Tests:

- Dialog: Enter applies the parsed width and closes; garbage keeps „Zastosuj" disabled; prefill.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Research: `context/changes/2026-10-22-column-width-command/research.md`
- Spike: `context/changes/2026-10-22-column-width-command/spike.md`, commit `aa595b47c`
- Pattern for the „Opcje" open context: `src/components/kosztorys/editor/actions/reorder-open.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure rules + batched store write

#### Automated

- [x] 1.1 column-width-targets spec passes
- [x] 1.2 create-json-map-store spec passes

### Phase 2: Editor wiring

#### Automated

- [x] 2.1 column-width-dialog spec passes
- [x] 2.2 kosztorys-actions-menu spec passes
