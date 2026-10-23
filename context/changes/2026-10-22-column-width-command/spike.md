# Spike results — select columns, type one width (option C)

Branch `spike/column-width-command` (worktree `.claude/worktrees/column-width-spike`, uncommitted).
Driven in the browser against `wykonczymy-test` (5435), editor of „Anna Iwanicka 2 łazienki", 1600×1000.
Companion to `research.md` (main checkout, same change folder).

## Shape built (~150 lines)

- `ui/datasheet-grid/header-menu-extension.tsx` — two contexts: the column id (provided by
  `ResizableHeader`) and an optional extension `{ onOpen(colId), items(colId) }`. `HeaderMenu` calls
  `onOpen` from `onOpenChange(true)` and appends `items` after a separator. `ui/` stays domain-agnostic.
- `HeaderMenu` trigger: `onPointerDownCapture` → `stopPropagation()` when Shift is held.
- `editor/hooks/use-column-width-command.tsx` — snapshots `datasheetRef.current.selection` on menu open,
  maps `min.col..max.col` onto `gridColumns` ids, keeps sizable ones (excludes `actions`, `layerGap`,
  pinned-by-design columns), falls back to the clicked column when it lies outside the selection.
- `editor/dialogs/column-width-dialog.tsx` — `FormDialogShell` + `Input` inside `GridEventBoundary`;
  Enter applies `Math.max(RESIZE_MIN_PX, round(n))`; prefilled when all targets share a stored width.
- `createJsonMapStore` gained `setMany` (one write, one notify); `useColumnWidths` gained `setWidths`.
- The provider wraps `DynamicDataSheetGrid` in the body; off in preview / report / readOnly.

## Verified in the browser

| Check                                                     | Result                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Click on the empty part of a header (above the label)     | selects the whole column — research risk 1 is gone                               |
| Click on the label afterwards                             | menu opens, dsg selection survives (Radix cancels the pointerdown)               |
| Drag across empty header areas, 5 columns                 | menu shows „Szerokość kolumn (5)…", dialog „Szerokość 5 kolumn"                  |
| Type 100 + Enter                                          | all 5 headers 100 px; store holds exactly those 5 ids; no grid cell left editing |
| Shift+click another column's label                        | no menu; selection extends (row 0 only, as predicted) → 6 columns offered        |
| Drag across body cells (rows 1–3, 4 columns) → label menu | „Szerokość kolumn (4)…"                                                          |
| „Przywróć domyślną szerokość"                             | drops exactly those 4 ids; columns back to defaults                              |
| Type 10                                                   | clamps to 40                                                                     |
| Narrow „Opis prac" to 150                                 | text truncates with „…", row heights unchanged — same as a drag-resize today     |

## Not verified / open

- Typecheck and lint not run; the dev server compiled every touched file without error.
- The extension object is rebuilt every render, so each header menu consumer re-renders with the body.
  Measure on the 1000-item perf dataset (`INV=7`) before shipping; memoise if it shows.
- Stage columns and fit-rows mode not exercised.
- Discoverability: the empty header strip is ~25 px above a 32 px label in an 84 px header; Shift+click
  on the label covers the rest. Neither gesture has a visible hint.
