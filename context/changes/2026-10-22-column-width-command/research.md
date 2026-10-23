---
date: 2026-10-22T18:13:28+0200
researcher: Claude (Opus 5.5)
git_commit: 8791ac927
branch: staging
repository: wykonczymy
topic: 'Option C — select columns in the kosztorys grid, then type one pixel width for all of them'
tags: [research, codebase, kosztorys-editor, react-datasheet-grid, column-widths, radix]
status: complete
last_updated: 2026-10-22
last_updated_by: Claude (Opus 5.5)
---

# Research: select columns, then type one width (option C)

**Date**: 2026-10-22T18:13:28+0200
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 8791ac927
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Excel: select columns → _Column Width…_ → type a number. Sheets: select columns → _Resize columns A–F_ →
type px. Can the kosztorys editor (react-datasheet-grid 4.11.6, "dsg") do the same: how does a column
selection arise given our Radix header triggers, how is it read and kept alive until the command runs,
where does the command live, how does one width reach N ids in the width store, and what can go wrong.

## Summary

Feasible without patching dsg. Three facts shape the design:

1. **dsg already has the selection.** A mousedown in the header row selects the whole column; dragging
   across headers or across body cells selects a contiguous range. Only one rectangle exists (no
   Ctrl/Cmd multi-select; on macOS Ctrl+click is a right click). Shift+click on a second header yields
   columns E..H but only row 0 — harmless, because Excel applies _Column Width_ to the columns of any
   selected range, so the command should use the selection's **column span** and ignore its rows.
2. **Our header labels block it.** Every editable header's label is a Radix `DropdownMenuTrigger`
   whose `pointerdown` calls `preventDefault`, which suppresses the compatibility `mousedown` dsg
   listens for. The label opens the menu and never selects. The label box is content-sized, so the rest
   of the 84 px header cell (padding, space right of the label, most of the height) very likely does
   select today — derived from CSS, unverified in a browser.
3. **The selection dies on any mousedown outside the grid**, including a click in a portaled menu or a
   toolbar button. But opening a header menu does _not_ clear it (Radix cancelled the mousedown). So the
   command lives **in the header menu**, and the selection is snapshotted when the menu opens (or
   continuously via `onSelectionChange`, ids resolved at snapshot time).

Resulting shape (Sheets' right-click behaviour): every header menu gets **„Szerokość kolumn…"**. If the
snapshotted selection spans this header's column → applies to every eligible column in the span
(„Szerokość kolumn (4)…"); otherwise → just this column. A dialog with a px input wrapped in
`GridEventBoundary`; one `store.update` writes all ids.

## Detailed Findings

### dsg selection internals

- Listens to `mousedown` (not pointer events) on `document`, bubble phase, no options
  (`node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js:789`,
  `dist/hooks/useDocumentEventListener.js:7`). Inside-test: `innerRef.current.contains(event.target)`
  (`DataSheetGrid.js:638`); the header row is inside `innerRef` (`dist/components/Grid.js:91-104`).
- Cell from coordinates, not target: `getCursorIndex` (`DataSheetGrid.js:150-186`). `row === -1` is
  the header, `col === -1` the gutter. Public `col` = index into our `columns` prop (gutter is −1)
  (`dist/hooks/useColumns.js:88-121`).
- Header click → whole column: active cell row 0, selection corner `row = data.length - 1`
  (`DataSheetGrid.js:693-711`, `737-763`). Header drag → `selectionMode = { columns: true, rows: false }`,
  rows stay full while columns extend (`:717-729`, `:884-896`).
- Shift+click on a header keeps the active cell but sets the corner to row 0 (`:693`, `:730-734`).
- Top-left corner selects all (`:745-751`); Ctrl/Cmd+A selects all while a cell is active (`:1074-1090`).
- Cleared by: mousedown outside the grid → `setActiveCell(null)` + `setSelectionCell(null)`
  (`:695`, `:766`); Escape (`:1017-1023`). Not by blur, data change or column change — a column change
  keeps the **indices**, so they then point at different columns (`onSelectionChange` re-fires, `:1318`).
- Read API (`dist/types.d.ts:182-197`): `SelectionWithId = { min: CellWithId; max: CellWithId }`,
  `CellWithId = { colId?, col, row }`; `colId` = `columns[col].id` (`dist/utils/typeCheck.js:22-31`),
  only for min/max — slice `gridColumns` for the columns between. `onSelectionChange` runs in an effect
  after commit and reports a lone active cell as a 1×1 selection (`DataSheetGrid.js:1302-1319`).
  `ref.current.selection` holds the same value. `setSelection` scroll-jumps to the corner (`:310-320`).
- dsg's context menu is unusable: `disableContextMenu = disableContextMenuRaw || lockRows` (`:66`) and
  the editor passes `lockRows` (`src/components/kosztorys/editor/kosztorys-editor-body.tsx:478`). Its
  item union has nothing column-level (`types.d.ts:100-108`). Dropping `lockRows` would bring back row
  insert/duplicate/smart-delete — not viable.
- Selection is index-based and ignores horizontal virtualization (`dist/hooks/useColumnWidths.js:84-90`,
  `Grid.js:61-79`); disabled columns are selectable (`SelectionRect.js:55-67`).
- The patch `patches/react-datasheet-grid@4.11.6.patch` touches no selection/mouse/menu code (only
  `resetRowHeights` + row-height cache).
- While an active cell exists, dsg's `document` `keydown`/`paste` listeners start editing on a
  printable key, delete on Backspace, swallow arrows (`:912-916`, `:1057-1072`, `:1015`, `:628`). A width
  input must sit in `GridEventBoundary` (`nativeEvent.stopImmediatePropagation`).

### Our header cells and the Radix trigger

- In the editor (not read-only), every text column header is `SortHeader` → `HeaderMenu` →
  `HeaderMenuTrigger` (Radix `DropdownMenuTrigger`) (`grid/column-headers.tsx:24-49`,
  `grid/sort-header.tsx:30`, `ui/datasheet-grid/header-menu.tsx:34-52`,
  `ui/datasheet-grid/header-menu-trigger.tsx:13-18`). Stage headers use the same `HeaderMenu`
  (`grid/stage-header.tsx:104-193`). `onSetSort` is set whenever the grid isn't read-only
  (`use-kosztorys-editor.ts:474`).
- Radix 2.1.16 trigger (`@radix-ui/react-dropdown-menu/dist/index.mjs:74-79`): on `button === 0 &&
!ctrlKey` → toggle, `if (!context.open) event.preventDefault()`. Shift/Meta/Alt are ignored — a
  Shift+click on a label opens the menu like a plain click.
- Trigger box = label content: `.dsg-cell-header-container` has `padding: 0 10px` and shrinks to content
  in a flex `.dsg-cell` (dsg `style.css:95-98`; our note at `ui/datasheet-grid/column-resize-handle.tsx:59-61`).
  Header row is 84 px (`lib/kosztorys/row-height.ts:9`). Uncovered area should select the column.
- Other header handlers: the column resize strip and the gutter's row-resize strip both
  `preventDefault` + `stopPropagation` (`column-resize-handle.tsx:28-34`, `row-resize-handle.tsx:16-20`).
- No-menu headers in the editor: `actions` (`grid/row-actions-column.tsx:34`, fixed 64 px), trailing
  `layerGap` (`grid/column-sizing.tsx:41-53`), the gutter. Read-only mode has no menus at all.
- Nothing in `src` uses `onSelectionChange`, `setSelection`, `contextMenuComponent` or
  `onContextMenu` on the grid. `datasheetRef` (`hooks/use-row-sizing.ts:45`) is only used for
  `resetRowHeights`.
- Shortcuts: undo is a `window` keydown hook skipping dialogs/inputs (`hooks/use-undo-keyboard.ts:15-43`,
  mounted `kosztorys-editor-body.tsx:214`) — the pattern for an optional Alt+key shortcut (match
  `event.code`; Alt changes `event.key` on macOS). dsg owns Cmd/Ctrl+D and +A.

### Width store and how widths apply

- Store: `hooks/use-column-widths.ts` over `createJsonMapStore('kosztorys-v2-col-widths')`
  (`src/hooks/create-json-map-store.ts`). `set` and `drop` are thin wrappers over `update` (`:59-76`),
  which re-reads, writes once, notifies once, and skips when the updater returns `prev`. N `set`s =
  N writes + N notifies; one `update` = one rebuild. Precedent: `dropWidth` is variadic for exactly this
  reason (commit `2c6075276`).
- Apply: `withResize` (`grid/column-sizing.tsx:14-39`) skips no-id and fixed (`minWidth === maxWidth`)
  columns, pins a stored width via `pinnedWidth` (basis = min = max, grow/shrink 0), defaults minWidth
  to 130. Called in `selectV2Columns` before `withColumnColor`, with `layerGap` appended
  (`grid/column-selection.ts:124-127`).
- Keys are the full rendered `col.id` (`price__<plane>`, `stage_<id>`, `stageValueNet_<id>`…), not the
  toggle/group key. One id = one column per grid; the same id is shared across views and **across all
  kosztorysy and szablony** (widths and colours have no workshop scope, unlike hidden columns / order /
  row heights — `use-hidden-columns.ts:6,9`, `use-column-order.ts:7-8`, `use-row-heights.ts:5,7`).
- dsg index → id: `columns={gridColumns}` (`kosztorys-editor-body.tsx:471`), a 1:1 map of the editor's
  columns (`:279-317`), report transform already included (`use-kosztorys-editor.ts:523`).
- Re-measure: a store write → new `columns` identity → `useRowSizing` (`use-row-sizing.ts:46-50`) →
  one rAF measure (`use-wrap-column-widths.ts:31-63`) → `resetRowHeights(0)` when fit-to-content is on
  (`use-row-height-cache-reset.ts:23-35`). Cost is per write, not per column.
- Min width: drag clamps only to `RESIZE_MIN_PX = 40` (`column-resize-handle.tsx:10,44`, not exported) —
  deliberately below a column's design minWidth. A typed width should match: `Math.max(40, round(w))`,
  reject non-finite. `0` would pin a 0 px sliver; `NaN` serialises to `null`.

## Code References

- `node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js:66` — `lockRows` disables dsg's context menu
- `…/DataSheetGrid.js:693-763` — header mousedown → whole-column selection; shift path → row 0
- `…/DataSheetGrid.js:1302-1319` — `onSelectionChange` effect
- `node_modules/@radix-ui/react-dropdown-menu/dist/index.mjs:74-79` — trigger `pointerdown` preventDefault
- `src/components/ui/datasheet-grid/header-menu.tsx:34-52` — where a domain-agnostic capture hook / item slot would go
- `src/components/kosztorys/editor/grid/sort-header.tsx:30`, `grid/stage-header.tsx:104-193` — the two menus that get the item
- `src/components/kosztorys/editor/grid/column-sizing.tsx:14-39` — eligibility (`withResize`) and pinning
- `src/hooks/create-json-map-store.ts:59-76` — `update` = the single-write path
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:460-496` — grid mount (`datasheetRef`, `lockRows`)
- `src/components/ui/datasheet-grid/grid-event-boundary.tsx:6-17` — wraps the width dialog

## Architecture Insights

- **Snapshot, don't hold.** Keeping the selection alive across a portaled dialog fights dsg's document
  listeners. Snapshot `{ ids }` (resolved from `gridColumns` at that moment, not indices) when the header
  menu opens, then let dsg clear it.
- **Eligibility must be decided before pinning.** After `pinnedWidth`, a resized column also has
  `minWidth === maxWidth`, so re-running `withResize`'s fixed-column test on the output misclassifies it.
  `selectV2Columns` should expose the resizable id set (or a shared `isResizable(col)` run pre-pin).
- **Single write.** Add `setMany` beside `drop` on `JsonMapStoreT` (returns `prev` when nothing changes),
  and `setWidths(ids, px)` on `useColumnWidths`.
- **Domain-agnostic seam.** The menu item and the dialog are `ui/datasheet-grid` concerns only if they
  take ids + a callback; resolving "which ids does the selection cover" knows `gridColumns` and belongs
  in the editor (`kosztorys/editor/hooks/`, per `src/components/kosztorys/AGENTS.md`), not in
  `KosztorysEditorProvider`.
- **Optional Shift+click on labels**: an `onPointerDownCapture` on the `HeaderMenu` wrapper that calls
  `stopPropagation` (no preventDefault) when Shift is held stops Radix's handler while the browser still
  fires the `mousedown` dsg needs. Unverified — first thing the spike checks.

## Historical Context (from prior changes)

- Per-browser localStorage widths, storing only deviations, is deliberate (`context/foundation/roadmap.md:654-657`);
  column colours reused it (`context/archive/2026-10-05-column-colors/change.md:17-23`). Row heights are
  "sparse, like column widths" (`context/archive/2026-08-31-kosztorys-row-height/change.md:33`).
- Commit-on-release resize = one re-layout per drag (`column-resize-handle.tsx:6-8`). Widths reflow
  without remount since `DynamicDataSheetGrid` (commit `ee497cbf6`).
- Below-design-min widths allowed on purpose (commit `24360e453`).
- No prior slice, doc or code for bulk resize or a width reset.
- Lesson (`context/foundation/lessons.md`, "Events and focus"): dsg's listeners sit on `document`
  beside React's root — only `nativeEvent.stopImmediatePropagation()` outruns them.

## Related Research

- `context/archive/2026-10-05-column-colors/` — the sibling per-column preference
- `context/archive/2026-08-31-kosztorys-row-height/` — row-height store and resize handle

## Risks for the spike

- Empty-header-area selection is CSS-derived — verify first in the browser; if the area is too small or
  undiscoverable, the label Shift+click bypass becomes required, not optional.
- Selection snapshot timing: menu `onOpenChange(true)` must see dsg's selection before anything clears it.
- Stale snapshot: intersect snapshot ids with the ids rendered at write time (a reissued stage id must
  not inherit an orphan).
- Excluded ids: `actions`, `layerGap`, report-injected and report/phone-preview-overridden `description`/`unit`.
- Pinning `description`/`note` drops their `grow` → blank space right of the sheet. Matches Excel (widths
  are absolute), but the owner should see it.
- Global scope: one bulk write reshapes every kosztorys and szablon in that browser.
- No undo, no reset today. `store.drop(...ids)` makes „Przywróć domyślną szerokość" a one-liner in the
  same menu.
- Synthetic rows (spacer, totals) are part of a whole-column selection — irrelevant, the command reads
  columns only.

## Open Questions

- Does the owner want „Przywróć domyślną szerokość" in the same menu? (cheap; recommended)
- Prefill the dialog with the common stored width when all selected columns share one, else blank?
- Should widths stay global across kosztorysy and szablony, or get the workshop split the other
  per-column preferences have? (Existing behaviour; out of this change unless the owner asks.)
