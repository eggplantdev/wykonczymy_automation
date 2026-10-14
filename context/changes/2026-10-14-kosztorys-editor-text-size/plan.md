# Kosztorys editor text size — Implementation Plan

## Overview

The kosztorys editor grid gets the same font-size control the data tables have: a radio list
„Ustal wielkość czcionki w tabeli” in the editor's view menu, with three sizes, „Bardzo mała”
(10px), „Mała” (12px) and „Średnia” (14px, the default). Only the font changes. The 20px line
height, the 32px rows and the column widths stay fixed. „Dopasuj wysokość do treści” re-fits on
its own, because a smaller font wraps into fewer lines.

## Current State Analysis

- Cell text is hard-coded `text-sm max-sm:text-xs` in four primitives:
  - `ReadOnlyCellText` (`src/components/ui/datasheet-grid/read-only-cell-text.tsx`)
  - `EditableCellInput` at rest, plus `typing-surface` while focused (`editable-cell-input.tsx`)
  - the `CellSelectMenu` trigger (`cell-select-menu.tsx`, also used outside the grid by
    `src/components/ui/simple-select.tsx`)
  - `SectionFooterCell`, the „Razem” label and figures
    (`src/components/kosztorys/editor/grid/cells/section-footer-cell.tsx`)
- Fit-to-content measures text with a canvas font that `use-wrap-column-widths.ts` assembles from
  constants: `CELL_FONT_SIZE = '14px'`, `PHONE_CELL_FONT_SIZE = '12px'`, picked by `matchMedia`. It
  therefore ignores both a different cell size and the app-wide ui-scale, which changes the root
  font-size.
- The returned `{ widths, font }` object keys the row-height cache reset
  (`useRowHeightCacheReset` in `kosztorys-editor-body.tsx` ~397). A new `font` string is exactly
  what makes the rows re-fit.
- The tables' control lives in `src/components/tables/data-table/column-toggle.tsx`:
  `TEXT_SIZE_OPTIONS` plus a `DropdownMenuLabel` + `DropdownMenuRadioGroup` in the
  `ColumnToggleMenu` footer, where `onSelect` calls `preventDefault` so the menu stays open.
- The editor's menu is `KosztorysViewMenu`
  (`src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx`), which renders the same
  `ColumnToggleMenu` (`src/components/ui/column-toggle-menu.tsx`).
- Per-browser view preferences in the editor go through `usePersistedEnum`
  (`src/hooks/use-persisted-value.ts`). `use-crew-axis.ts` is the pattern. The store is
  module-level and fans out to every hook over a key, so two components can each call the hook and
  stay in sync without context.

## Desired End State

- The editor's view menu has a „Ustal wielkość czcionki w tabeli” section with three options. Picking
  one changes the font of item cells and of the section „Razem” row immediately, with the menu
  still open.
- The section band title (text-lg), the grand totals at the bottom (text-base), the column headers
  and the gutter numbers do not change.
- With „Dopasuj wysokość do treści” on, rows re-fit to the new size without a reload.
- The setting is per browser and shared by all kosztorysy. A reload or another kosztorys shows the
  same size.
- An edited cell shows the chosen size on desktop. On a phone the edit field keeps the 16px floor,
  so iOS doesn't zoom.
- `SimpleSelect` and every other non-grid use of the primitives look exactly as before.

### Key Discoveries:

- `src/components/kosztorys/editor/hooks/use-wrap-column-widths.ts:13-19`: the measurement font is
  composed, not read, so it has to start reading the rendered size, or rows will fit a font the
  cells no longer use.
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:378-397`: `wrap` (`widths` + `font`)
  feeds both `measureTextWidth(wrap.font)` and the height-cache reset. Changing `font` is enough to
  re-fit, and no new invalidation path is needed.
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:580`: the `ref={gridRef}` wrapper is
  both the measurement container (`gridNode`) and an ancestor of every cell, so one attribute plus
  one CSS variable there reaches all cells.
- `src/styles/globals.css:249`: `typing-surface` is `max(text-base, 16px)` below `sm` and `text-sm`
  from `sm`.
- `src/components/tables/data-table/column-toggle.tsx`, with its importers already pointing there, is
  another session's uncommitted move out of `src/components/filters/`. Build against the new path,
  and only add the extraction on top of it. Don't commit or revert the move itself.

## What We're NOT Doing

- No clipped „…” indicator (ruled out by the user).
- No row-height or line-height scaling, no column-width scaling, and no „Duża” size.
- No change to the section band title, the grand-total rows, header labels or the gutter.
- No per-kosztorys or server-side persistence, and no value in `KosztorysEditorProvider`.
- No change to the data tables' own four-size control, beyond reading options from the shared
  section.

## Implementation Approach

One CSS variable set on the grid wrapper and read by a single utility on every cell primitive.
Unset, it falls back to today's classes, so code outside the grid is untouched by construction.
The wrapper carries the same utility, so its computed `font-size` is the cell font, and the
measurement reads that instead of constants. The persisted hook is called by the editor body
(for the attribute) and by the view menu (for the radio), and the shared `usePersistedEnum` store
keeps the two in sync.

## Critical Implementation Details

- **Focused input cascade.** `typing-surface` and the new grid utility both set `font-size`. On
  desktop the focused input must follow the grid size; below `sm` it must keep the 16px floor.
  Don't rely on two utilities being emitted in a particular order. Compose it so that only one
  rule applies at each breakpoint: either a grid-scoped variant of `typing-surface`, or
  `typing-surface` below `sm` and the grid utility from `sm`. Check this in the browser, not in a
  class string.
- **Re-measure trigger.** The measurement effect doesn't re-run on its own when the cells' font
  changes (no ResizeObserver, on purpose; see the comment in the hook). The text size has to be
  part of what `measure` depends on, so a size change both recomputes `font` and re-runs the
  effect. Read `getComputedStyle` after the attribute has rendered, which the existing rAF in the
  effect already guarantees.

## Phase 1: Grid text-size plumbing

### Overview

The grid reacts to a persisted text size: cells and „Razem” change font, the measurement follows,
and rows re-fit. There is no UI yet; the size can be set from localStorage or the attribute.

### Changes Required:

#### 1. Grid cell text utility

**File**: `src/styles/globals.css`

**Intent**: One utility every grid text primitive uses, in place of `text-sm max-sm:text-xs`. It
reads a variable that only the editor wrapper sets.

**Contract**:
- `@utility grid-cell-text`: `font-size` is `var(--grid-cell-text, var(--text-xs))` below `sm` and
  `var(--grid-cell-text, var(--text-sm))` from `sm`, with a fixed 20px line height (`--spacing * 5`).
- Selectors on the kosztorys grid wrapper map `[data-text-size='2xs']` to
  `--grid-cell-text: var(--text-2xs)` and `[data-text-size='xs']` to `var(--text-xs)`.
- `'sm'` sets no variable, so the default stays today's responsive pair exactly.

#### 2. Cell primitives use it

**Files**:
- `src/components/ui/datasheet-grid/read-only-cell-text.tsx`
- `src/components/ui/datasheet-grid/editable-cell-input.tsx`
- `src/components/ui/datasheet-grid/cell-select-menu.tsx`
- `src/components/kosztorys/editor/grid/cells/section-footer-cell.tsx`

**Intent**: Replace `text-sm max-sm:text-xs` (and `max-sm:text-xs/5`) with `grid-cell-text`. Wire
the focused state of `EditableCellInput` per the cascade note above.

**Contract**: Outside a wrapper that sets the variable, the rendered size is unchanged, which is
what keeps `SimpleSelect` the same. The section band title and synthetic total rows are not
touched.

#### 3. Persisted size hook

**File**: `src/components/kosztorys/editor/hooks/use-grid-text-size.ts` (new)

**Intent**: One global per-browser setting, following `use-crew-axis.ts`.

**Contract**:
- `useGridTextSize(): [GridTextSizeT, (size: GridTextSizeT) => void]`.
- `GridTextSizeT` is `'2xs' | 'xs' | 'sm'`, a subset of `TableTextSizeT`.
- It wraps `usePersistedEnum('kosztorys-text-size', …, 'sm')`. The key is its own: the tables'
  `table-text-size:` prefix stores JSON-encoded strings, while `usePersistedEnum` stores raw ones.

#### 4. Wrapper carries the size

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Put `data-text-size={textSize}` and `grid-cell-text` on the `ref={gridRef}` wrapper.
Pass `textSize` to `useWrapColumnWidths`.

**Contract**: The wrapper's computed `font-size` equals the cell font at every breakpoint and size.

#### 5. Measurement reads the rendered font

**File**: `src/components/kosztorys/editor/hooks/use-wrap-column-widths.ts`

**Intent**: Build the canvas font from `getComputedStyle(container).fontSize` instead of
`CELL_FONT_SIZE` / `PHONE_CELL_FONT_SIZE` / `matchMedia`, and re-measure when the size changes.
Drop the constants and their comment.

**Contract**:
- `useWrapColumnWidths(containerRef, columnIds, textSize)`, where `textSize` only drives
  re-measurement.
- The returned `font` changes identity only when the computed font actually changes. Keep the
  existing `prev` short-circuit.

#### 6. Spec

**File**: `src/__tests__/components/kosztorys/editor/hooks/use-wrap-column-widths.test.tsx`

**Intent**: Guard the re-fit path. With the container's `font-size` at 14px, then changed to 12px
and re-rendered with a new `textSize`, `result.current.font` contains `12px`. An unchanged size
keeps the same object.

### Success Criteria:

#### Automated Verification:

- Wrap-widths spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-wrap-column-widths.test.tsx`

#### Manual Verification:

- Editor at the default size looks identical to before (cells, „Razem”, a dropdown cell, an edited
  cell).
- After setting `localStorage['kosztorys-text-size'] = 'xs'` and reloading, item cells and „Razem”
  are smaller. The section title, the grand totals and the headers are unchanged.
- With „Dopasuj wysokość do treści” on, long descriptions take fewer lines at the smaller size.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Manual
verification is collected once, at the end, into the manual-checks registry.

---

## Phase 2: The control in the view menu

### Overview

The radio section becomes a shared component. The tables keep four sizes, and the editor's view
menu shows three.

### Changes Required:

#### 1. Shared text-size menu section

**File**: `src/components/tables/data-table/text-size-menu-section.tsx` (new), plus
`src/components/tables/data-table/column-toggle.tsx`

**Intent**: Move the label, the radio group and the keep-open `onSelect` out of `ColumnToggle`
into one component, so the editor doesn't copy it. `ColumnToggle` renders it with all four sizes.

**Contract**:
- `TextSizeMenuSection<T extends TableTextSizeT>({ sizes, value, onChange })`.
- `sizes` is a readonly subset of the four sizes, mapped to the existing `textSize*` i18n keys.
- The value is validated against `sizes` before `onChange` is called.

#### 2. Editor view menu

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx`

**Intent**: Render the section with `['2xs', 'xs', 'sm']` as the last block of the menu, wired to
`useGridTextSize()`.

**Contract**: Nothing goes into the editor context. The menu and the body each call the hook.

#### 3. Spec

**File**: `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-view-menu.test.tsx` (new;
mock the editor context the way `menus/kosztorys-filters-menu.test.tsx` does)

**Intent**: Check that:
- the menu lists exactly „Bardzo mała”, „Mała”, „Średnia”, with „Średnia” checked by default;
- picking „Mała” checks it, persists `'xs'` under `kosztorys-text-size`, and leaves the menu open.

### Success Criteria:

#### Automated Verification:

- View-menu spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/kosztorys-view-menu.test.tsx`
- Wrap-widths spec still passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-wrap-column-widths.test.tsx`

#### Manual Verification:

- Editor → „Kolumny” menu → „Ustal wielkość czcionki w tabeli” → „Mała”: the grid behind changes
  at once and the menu stays open.
- With „Dopasuj wysokość do treści” on, switching between „Bardzo mała” and „Średnia” re-fits the
  rows with no reload.
- After a reload, and when opening another kosztorys, the chosen size is still selected.
- Any data table (e.g. Transakcje) still offers four sizes, including „Duża”, and still works.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Manual checks

### Overview

Roll the manual bullets from phases 1–2 into `context/foundation/manual-checks.md` under
`## 2026-10-14 — kosztorys-editor-text-size`, adding a phone check: on a phone, editing a cell
does not zoom the page.

### Success Criteria:

#### Automated Verification:

- Registry section exists: `grep -n "kosztorys-editor-text-size" context/foundation/manual-checks.md`

---

## Testing Strategy

### Unit Tests:

- `use-wrap-column-widths`: the font follows the container's computed size, a size change
  re-measures, and an unchanged size keeps the same object (the cache-reset key).

### Component Tests:

- `KosztorysViewMenu`: three options, the default checked, a selection persists and keeps the menu
  open.

### Manual Testing Steps:

1. Default size: no visual change anywhere in the editor.
2. Each of the three sizes: items and „Razem” change, other parts don't.
3. „Dopasuj wysokość do treści” re-fits on a size change.
4. Persistence across a reload and across kosztorysy.
5. On a phone (390px): an edited cell doesn't trigger iOS zoom.

## Performance Considerations

A size change resets the row-height cache once, the same cost as toggling „Dopasuj” today.
Measurement adds one `getComputedStyle` per measure call, which is negligible next to the header
`getBoundingClientRect` reads it already does.

## Whole-tree Gate

Run once after the final phase, **only when the user asks**:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`

## References

- Tables' control: `src/components/tables/data-table/column-toggle.tsx`,
  `src/components/tables/data-table/table-text-size.ts`
- Persisted pattern: `src/components/kosztorys/editor/hooks/use-crew-axis.ts`
- Measurement: `src/components/kosztorys/editor/hooks/use-wrap-column-widths.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Grid text-size plumbing

#### Automated

- [x] 1.1 Wrap-widths spec passes

### Phase 2: The control in the view menu

#### Automated

- [x] 2.1 View-menu spec passes
- [x] 2.2 Wrap-widths spec still passes

### Phase 3: Manual checks

#### Automated

- [x] 3.1 Registry section exists
