---
date: 2026-09-23T09:27:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 545a3282
branch: staging
repository: wykonczymy
topic: "Kosztorys v2 editor — bulk actions: row/column selection, bulk „auto" price source, bulk delete"
tags: [research, kosztorys, editor, react-datasheet-grid, bulk-actions, selection, subcontractor-price]
status: complete
last_updated: 2026-09-23
last_updated_by: Claude (Opus 5.5)
---

# Research: bulk actions in the kosztorys v2 editor

## Research Question

What would it take to add bulk actions to the kosztorys v2 editor: checkboxes to select whole rows
(prace), possibly selecting a column, and operations on the selection. The obvious candidates are
bulk-switching the settlement mode to „auto" and bulk-deleting prace.

## Summary

- **Nothing to reuse on the selection side.** The editor has no row-selection model. It never
  subscribes to react-datasheet-grid's (dsg's) own selection (`onSelectionChange` / `setSelection` /
  `ref.selection` are unused). `grid/column-selection.ts` is about which columns are _visible_, not
  what the user has selected.
- **dsg gives one contiguous rectangle for free.** It covers clicking the gutter (a row), a header (a
  column), Shift/drag and Cmd+A. It has **no disjoint multi-select**, so checkboxes (e.g. rows 3, 17
  and 240) are ours to build.
- **In our grid, clicking a header does _not_ select the column.** Every header is a Radix dropdown
  trigger, and Radix swallows the pointerdown. A „Zaznacz kolumnę" item in the header menu calling
  `datasheetRef.current.setSelection(...)` is a one-liner.
- **Bulk "set one value" in a column already half-exists.** Pasting one value over a taller range
  fills every row, and Delete clears the range. But each goes through `onChange` → **one server action
  per item×field**. That is N parallel Payload transactions, which is exactly what loses writes on
  Neon (lessons.md:2108, EX-855).
- **„Sposób rozliczenia" per item is really „Źródło ceny wykonawcy"** (auto / kwota stała), stored as
  two nullable overrides, one per tool plane. `null` means auto. A batched write that sets them to
  `null` already exists in `applyCatalogueValues`.
- **Bulk delete needs a new action**: one `DELETE … WHERE id = ANY`, an auto snapshot first, and a
  cascade of sections whose items are all selected. There is no in-session undo for delete today, and
  that stays true.
- **Recommended shape**:
  1. Selected item ids live in a per-editor Zustand store, so toggling one checkbox re-renders one
     cell, not the grid.
  2. The checkbox sits in the gutter, which is the only column pinned on the left.
  3. A floating action bar shows the counter.
  4. Each operation gets one batched raw-SQL action, with an auto snapshot before the write.

## Detailed Findings

### 1. The grid and selection

**What exists**

- `lockRows` is on (`kosztorys-editor-body.tsx:444`). This disables dsg's own add/delete rows and its
  context menu. Row add/delete in this grid is ours end-to-end (lessons.md:308).
- `datasheetRef` (`kosztorys-editor-body.tsx:249`) is only used to reset row heights
  (`hooks/use-row-height-cache-reset.ts:15`).
- The gutter is `ordinalGutterColumn` (`grid/ordinal-gutter-column.tsx:55-79`):
  - It is 38 px wide and the **only column pinned on the left**.
  - It carries three things: the item number, the section colour rail (`globals.css:502`) and the
    row-height drag handle.
  - Its header holds the header-height handle.
- The `actions` column (⋯, `grid/row-actions-column.tsx:37-52`) is 64 px wide and scrolls away when
  the grid scrolls horizontally.
- The only multi-select in the editor today is local to a dialog: `dialogs/catalogue-diff-table.tsx:43`
  (`Map<itemId, Set<field>>`). It is keyed by id, which is the principle to follow.

**What dsg gives for free** (`node_modules/react-datasheet-grid/dist/components/DataSheetGrid.js`)

- One rectangle `{min,max}` built from the active cell and a corner (:103-116). It is exposed through
  the ref and `onSelectionChange` (:1252-1263, :1297-1317). `setSelection` accepts a `colId`.
- Clicking the gutter selects a row and clicking a header selects a column (:737-760). Shift/drag
  extends the range (:717-734), and Cmd+A selects everything (:1074-1089).
- Delete over a range (:359-407) calls `deleteValue` on every cell and passes the result to
  `onChange`. Over a whole row that means **clearing przedmiar, cena and etapy at once** and N×F
  saves. It is a risk today, and one that checkboxes would make more common.
- Pasting one row into a taller selection fills every row (:509-529).
- Our patch (`patches/react-datasheet-grid@4.11.6.patch`) does not touch selection.

**Synthetic rows**

- The totals row, spacer, section header and section footer all have **negative ids**
  (`src/lib/kosztorys/synthetic-rows.ts:9-36`, `isSyntheticRow = id < 0`).
- So selection must be keyed by **item id**, never by row index, because the index shifts with
  sort/filter/collapse.
- „Zaznacz całą sekcję" cannot be derived from `gridRows`:
  - A collapsed section has no items in `gridRows` (`section-band-rows.ts:59`).
  - Section bands disappear entirely while sorting (`sectionBandsVisible(sort)`,
    `kosztorys-editor-body.tsx:242`).
  - It has to come from `rows` grouped by `sectionId`.
- The section checkbox has a **derived, three-valued state** (all / some = indeterminate / none) over a
  single set of leaf ids. See lessons.md:894 („Hierarchical visibility is ONE set of leaf exclusions").

**Performance**

- **Real size** (local copy of prod, 2026-09-23): 13 investments have a kosztorys; median 310 items,
  p90 376, max 379. 1000+ is the synthetic perf fixture's ceiling, not a realistic case. The count
  barely matters anyway: dsg virtualizes, so a toggle re-renders the visible window (~28 rows), not
  every row.

- dsg does not memoize per row. Any render of `KosztorysEditorBody` re-renders the whole visible
  window (`Grid.js:105-142`).
- A column's `component` must be a stable, module-level reference (lessons.md:145), and anything that
  varies goes through `columnData`.
- The selection `Set` therefore must not live in body state, `columnData` or `KosztorysEditorProvider`
  (the EX-496 context-churn regression; AGENTS.md).
- **Recommendation:** a Zustand store created per editor in a `useRef`, passed through a context whose
  value never changes.
  - A cell subscribes to `useStore(s => s.selected.has(rowData.id))`.
  - The toolbar subscribes to `s.selected.size`.
  - The hook that creates it is a leaf under `editor/hooks/` (EX-521).

**Conflicts with existing interactions**

- dsg listens on `document`, so React's `stopPropagation` is not enough. The checkbox must call
  `preventDefault` on pointerdown, following `ui/datasheet-grid/row-resize-handle.tsx:25-31`.
  Otherwise the click also moves the active cell.
- Shift-click in the gutter is already dsg's range extension. A Shift-range over checkboxes must not
  let the event through, or both selections move at once.
- Cmd+A is taken by dsg (it selects cells). Don't overload it.
- The gutter is cramped. The checkbox needs width (~38 → ~60 px) and CSS for the section header and
  footer variants of the gutter (`globals.css:554, :576`).

### 2. „Sposób rozliczenia" per item = „Źródło ceny wykonawcy"

- **Fields:** `wToolsOverrideValue` / `ownToolsOverrideValue` (`src/collections/kosztorys-items.ts:48-49`,
  rationale :6-10). The plane→field mapping is `OVERRIDE_FIELDS` (`lib/kosztorys/constants.ts:5`).
  - `null` = auto: cena klienta × the investment's współczynnik for the plane.
  - A number = kwota stała. `0` is a real amount (EX-766, `calc.ts:75`).
- **Not to be confused with:**
  - the investment's `settlementMode` NET/GROSS/MIXED (`lib/kosztorys/settlement-mode.ts:13`);
  - the stage's `plane` („Rozliczenie", `collections/kosztorys-stages.ts:34-40`);
  - the materiały pricing mode.
- **The per-item „auto" is plane-scoped.** A bulk switch has to answer _which plane_: the current
  view, or both.
- **Editing today** (`editor/grid/cells/subcontractor-columns.tsx`):
  - The „Źródło" cell is a `CellSelectMenu` (auto / kwota) that calls `modeChange`
    (`lib/kosztorys/subcontractor-price-edit.ts:52-58`).
  - Delete on the price cell calls `policy.clear` → `null`.
  - A bulk route already exists: select a range in the price column and press Delete. It is one undo
    command, but N actions.
- **What „auto" changes:**
  - It is recomputed only on the client (`viewPrice` / `subcontractorPrice`).
  - The ceiling guard judges only a kwota stała, so auto clears red verdicts
    (`subcontractor-price-guard.ts:82-110`).
  - Catalogue comparison treats kwota vs auto as a difference (`build-catalogue-comparison.ts:121`).
- **Domain hazard (domain-notes.md:398-406, 437-441):** `null` _invents_ a cost from the global
  multiplier. That is why the import writes `0`, not `null`, for missing rates. Switching 40 prace to
  auto can move a lot of money, and the precedent from the catalogue comparison is to show that
  amount before saving.
- **Scale** (local copy of prod): 4239 items, 3124 with a kwota stała and 1123 on auto
  (`stawka-problems-and-filters/change.md:22`).

### 3. The mutation path and undo

- **Single-cell edit:**
  - `onChange` (`use-kosztorys-editor.ts:1165-1210`) → `planGridChanges`, then
    `save(itemFieldLane(id, field), updateItemFieldAction)`.
  - Lanes are serialized **per key only** (`lib/kosztorys/save-lanes.ts:16-54`), so different rows
    run in parallel.
  - The optimistic update is `patchRows` (:1154), and the revert is `revertOne` (:689-701).
- **Undo:**
  - `gridCommand` → `runGridReversal` (:707-737).
  - The API is in `hooks/use-undo-redo.ts`: `pushCommand` (flushes the burst, :328),
    `pushReversible`, `pruneByIds`, `touchedIds`.
- **A bulk field update as ONE undo command**, two options:
  - **A (no new server code):** synthesize `FieldChangeT[]` and pass it to `gridCommand`. It costs N
    actions and carries the Neon risk.
  - **B (recommended):** a batched action taking `{id, value}[]`, plus
    `pushCommand({undo: apply(befores), redo: apply(afters), touchedIds})`. The befores differ per
    row, so the action takes per-row values rather than one scalar. Before the write, call
    `cancel(itemFieldLane(id, field))` on every selected id, so a pending keystroke can't overwrite
    the bulk write.
- **Batched precedents:**

  | Precedent             | Server                                                                | SQL                                                                                                                   | Client / undo                   |
  | --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
  | Rabat % on everything | `applyPercentDiscountToAllItemsAction` `actions/kosztorys.ts:239-263` | one `UPDATE` + snapshot                                                                                               | `patchRows` + rollback, no undo |
  | Catalogue → kosztorys | `applyCatalogueToKosztorysAction` `actions/work-catalogue.ts:263-327` | `applyCatalogueValues` `lib/db/kosztorys-catalogue-apply.ts:57-73`: `UPDATE … FROM (VALUES …)`, **value may be null** | patch from the result, no undo  |
  | Popraw literówki      | `cleanItemTextsAction` :268-289                                       | `setItemTexts` VALUES-join                                                                                            | remount (undo is lost)          |
  | Renumber              | `renumberKosztorysOrderAction` :565-614                               | `FOR UPDATE` + one statement                                                                                          | `pushCommand` before/after      |

- **Wrapping and side effects:**
  - Everything goes through `investmentAction`. That covers the investment lock, `updateTag` on
    `kosztorysItems`, and the automatic **szablon workshop mirror** (`investment-action.ts:84-91`).
  - A new batched action gets all of this for free.
  - Kosztorys edits **do not write** to the owner's Google Sheet. The only sheet writer is transfers.

### 4. Delete

- **Today, one item at a time:**
  - `removeItemAction` (`actions/kosztorys.ts:513-528`) takes an auto snapshot, then runs
    `payload.delete` on the one id.
  - The client (`handleRemoveItem`, `use-kosztorys-editor.ts:815-839`) turns deleting the last item
    of a section into deleting the section (`delete-policy.ts:11`).
  - It then removes the row optimistically, calls `pruneByIds`, and on failure restores the row after
    its `afterId` neighbour.
- **Every item delete asks for confirmation** (`grid/menus/kosztorys-row-actions-menu.tsx:81-97`,
  text in `removal-confirm.ts:3`). Undo never captures a delete. The recovery route is the auto
  version (`delete-confirm/change.md:38-40`).
- **Guards:**
  - Deleting populated items is allowed on purpose (EX-477).
  - There is no floor on the last item or last section (owner ruling, `delete-policy.ts:7-10`).
  - The only hard guard is the investment lock.
  - `stage_progress` goes through the FK cascade.
  - `display_order` needs no renumbering, because gaps are harmless.
- **Bulk delete means:**
  - a new action: `DELETE FROM kosztorys_items WHERE investment_id=$1 AND id = ANY($2)`, one
    statement on the transaction handle, with one snapshot before it;
  - **never** Payload `delete({ where })`, which removes row by row and swallows errors into
    `result.errors` (lessons.md:1513);
  - generalizing `isLastItemInSection` to "sections whose items are all selected get deleted too";
  - on the client: `pruneByIds(ids)`, `dropHeight`, and restoring the whole set on failure.

### 5. Other candidates the model supports cheaply

- **Item fields:** `section`, `displayOrder`, `description`, `unit`, `plannedQty`,
  `discountType` / `discountValue`, `clientPrice`, the two overrides, `note`.
- **Not item fields:** the worker and the plane belong to the **stage**, and client-view visibility is
  per investment.

| Candidate                                     | Cost                                                                              | Notes                |
| --------------------------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| Źródło → auto                                 | thin new action on top of `applyCatalogueValues` + id-ownership check             | the plane question   |
| Źródło → kwota stała (freeze the shown price) | same helper; the value per row is computed on the client                          | inverse of the above |
| Delete                                        | new action (§4)                                                                   | confirm + snapshot   |
| Rabat % on the selection                      | scope `applyPercentDiscountToAllItems…` to `id = ANY`                             | two columns          |
| Clear rabat / note                            | same VALUES pattern                                                               | —                    |
| Catalogue prices on the selection             | `applyCatalogueToKosztorysAction` already takes `selections`                      | —                    |
| Popraw literówki on the selection             | `setItemTexts` + an id filter                                                     | —                    |
| „100% w etapie X"                             | `setStageProgressAction` is a single upsert; batch it with `INSERT … ON CONFLICT` | new                  |
| Move to section                               | **no action exists**; `section_id` + `display_order` at the end of the target     | new, medium          |
| Duplicate                                     | **no action exists**; a copy-insert + copying `stage_progress`                    | new, medium          |

## Architecture Insights

- **Two selections side by side.** dsg's rectangle is the cell cursor (navigation, copy/paste).
  Checkboxes are a separate "working set" of item ids. The two must not share Shift/click events.
  „Zaznacz kolumnę" is a dsg rectangle. Bulk-setting a value in a column over the checked rows is a
  different gesture: action bar → pick a field → value.
- **Rendering selection is a subscription problem, not a state problem.** Only a store with a
  selector per cell keeps it O(1) re-render per toggle.
- **The server side is ready as a pattern:** VALUES-join / `= ANY`, `investmentAction`, auto snapshot.
  What's missing is only a thin action per operation.
- **The undo policy is inconsistent across bulk operations** (rabat %: none; renumber:
  `pushCommand`; literówki: remount). A field update with per-row befores fits naturally into
  `pushCommand`. Delete stays "snapshot only".

## Historical Context (from prior changes)

- `context/archive/2026-09-21-catalogue-compare-bulk-update/change.md:28-58`: **the closest
  precedent for a selection UI.** A checkbox on every number, a work-level checkbox as a shortcut,
  „zaznacz wszystkie", and an automatic version before the write. The bulk write stays off the undo
  stack. **Owner: no confirmation dialog** („przy pracy partiami potwierdzenie staje się odruchem"),
  only a counter on the button. And „update → kasuje nadpisanie" (a batched switch to auto) is
  already implemented there.
- `context/archive/2026-07-22-kosztorys-percent-rabat-bulk-apply/change.md:11-13` +
  `kosztorys-editor-domain-notes.md:575-581`: a bulk overwrite without Ctrl+Z, a confirm that says
  what is lost and how to get it back, and a snapshot. „Nie zgłaszaj ponownie «brak cofania» jako
  buga".
- `context/archive/2026-07-17-kosztorys-delete-confirm/change.md:16-40`: every delete confirms, the
  snapshot is taken on the server before the cascade („a client-only snapshot races autosave"), and
  deleting the last item cascades the section.
- `context/changes/2026-09-22-stawka-problems-and-filters/change.md:96-100`: „zaznacz / odznacz
  wszystkie" must be the same component as in the column picker (`ColumnToggleMenu`), not a second
  implementation.
- `kosztorys-editor-domain-notes.md:779-808`: the meaning of „auto" / „kwota stała". Removing the
  „Źródło" column was rejected twice.
- `kosztorys-editor-domain-notes.md:588-591`: Delete over a range writes zeros and does not delete
  rows.
- The roadmap, PRD and test-plan have **no** slice for multi-select or bulk. There is no
  "deferred/rejected" entry either, so this is new ground.

## Related Research

- `context/archive/2026-09-21-catalogue-compare-bulk-update/`
- `context/archive/2026-07-22-kosztorys-percent-rabat-bulk-apply/`
- `context/archive/2026-07-17-kosztorys-delete-confirm/`

## Open Questions

1. **Which plane does the bulk „auto" apply to:** the current price view, both, or the user's choice?
2. **Selection versus filter and collapse:** does a hidden or collapsed item that is checked still
   take part in the operation? The safer answer is "operate on what is checked _and_ visible, and
   show the count". But a section checkbox on a collapsed section is exactly the case where the user
   wants the whole section.
3. **Confirmation:** bulk delete keeps the confirm (the delete rule), and bulk „auto" is a counter +
   snapshot with no confirm (catalogue precedent)? It is also worth showing how much money moves.
4. **Undo:** a field update goes onto the stack (`pushCommand`), or "snapshot only" like the other
   bulk operations?
5. **Column selection:** is the goal only „Zaznacz kolumnę" (a dsg rectangle, for copy/paste/Delete),
   or "set a value in this column across the checked rows"? The second is an action-bar operation,
   not a selection.
6. **Should a range Delete over whole rows get a guard** (a confirm above a threshold or
   `disableSmartDelete`), since bulk selection will make those ranges more common?
7. Is the bigger fix for multi-cell paste/Delete (N parallel Payload updates → the Neon risk, EX-855)
   in scope, or separate?
