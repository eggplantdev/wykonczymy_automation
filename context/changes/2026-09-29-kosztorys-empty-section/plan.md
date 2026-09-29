# Sekcja bez pozycji w kosztorysie v2 — Implementation Plan

## Overview

A kosztorys v2 section can exist with zero items. „Dodaj → Sekcja" creates a bare section. Deleting
a section's last item leaves the section in place. The owner's grid shows an itemless section as a
header band with an inline „+ Dodaj pracę" button. Client outputs and any narrowed view hide it.

Decisions come from `research.md` → „Decisions (user, 2026-09-29)":

- Q1: bare section on creation.
- Q2: no cascade on last-item delete.
- Q3: hidden while a filter or search narrows the view.
- Q4: variant C — header band only.
- Q5: hidden in client outputs.

Also settled in the same thread:

- An itemless section has no chevron.
- The owner-facing name is „sekcja bez pozycji", and `itemless` in code. „Pusta sekcja" already
  means a section whose items carry no values.
- This change removes the cascade. EX-857 (bulk actions) drops its plan to generalize it.

## Current State Analysis

**The invariant lives in the client, not the data.** The DB, the tree loader, snapshots, szablony
and sheet import already carry a section with `items: []`.

The editor throws that section away in `treeToRows` (`src/lib/kosztorys/v2-rows.ts:20-49`), which
flattens items only. From then on, section order, name and colour are re-derived from item rows:

- `sectionRepresentatives` (`section-band-rows.ts`);
- `sectionSubtotalsForView` (`settlement-aggregates.ts:60-134`);
- `groupBySection`, `neighborSectionId` and `swapSectionBlock` (`row-ops.ts:162-224`);
- `computeMoveEdges` (`move-edges.ts`).

Three mechanisms enforce "≥1 item" today:

1. **Creation.** `createSectionWithFirstItem` (`src/lib/kosztorys/create-section.ts`) always mints a
   blank item, called from `addSectionAction` / `insertSectionAction` (`src/lib/actions/kosztorys.ts:300-392`).
2. **Deletion.** `handleRemoveItem` → `isLastItemInSection` → `handleRemoveSection`
   (`use-kosztorys-editor.ts:820-825`, `src/lib/kosztorys/delete-policy.ts`). The server never
   cascades.
3. **Visibility.** `buildSectionBandRows` skips a section with no rows in view.

Other consequences of section metadata being denormalized onto rows:

- Rename and colour on a section with no rows silently no-op: `handleSetSectionField` reads `before`
  from a row (`:1070`).
- `handleAddItem` samples a row for name and colour (`:788-794`).
- Undo has a gap. Section rename and colour commands carry no `touchedIds`. Section reorder uses the
  section's item ids (`:922`), which is `[]` for an empty section. After a section delete, undoing an
  earlier section command writes against a dead id.
- `treeToken` (`kosztorys-editor-v2.tsx:30`) keys remount on revision + item count. A section added
  or removed in another tab changes neither.

## Desired End State

**The owner's grid:**

- Every section from `tree.sections` renders in its stored order, including itemless ones, as long
  as bands are on (no whole-kosztorys sort) and no search or engaged condition narrows the view.
- An itemless section is a header band only: dot, name, „(0 poz.)", an inline „+ Dodaj pracę"
  button, and the ⋯ menu. It has no chevron, no collapse toggle and no footer.
- Rename, colour, ▲/▼ and insert above/below all work on it. Undo is correct across a later
  delete of that section.
- The ⋯ menu carries „Dodaj pracę" for every section.

**Creating and deleting:**

- „Dodaj → Sekcja" and insert above/below create a bare section.
- „Dodaj → Praca" on a kosztorys with no sections creates a section and then a pozycja in it.
- Deleting the last item leaves the section.

**Other surfaces:**

- The „Dodaj → Praca" submenu and the catalogue picker list every section, itemless included. This
  also fixes the existing mislabel, where an existing empty section was offered as „nowa".
- Preview, the share link, „Wydruk oferty" and the worker print show no itemless section.
- The „… jest pusty" empty state shows only when there are no sections at all (owner) or no items
  (client).

### Key Discoveries

- The server already handles itemless sections. `addItemAction` and the catalogue append use
  `COALESCE(MAX+1, 0)` (`create-item.ts:22-30`). `removeSectionAction`, `swapSectionOrderAction` and
  `updateSectionFieldAction` are section-only. **The only server change is dropping the seeded
  item.**
- Prints and the worker summary are already row-derived, so Q5 holds there for free. Only the
  preview grid needs the explicit flag.
- Most `subtotals` consumers gate on "has items": `hasRows` in the toolbar, preview header and
  totals panel, plus the worker summary. So `subtotals` **stays item-derived**. List-of-sections
  consumers move to a new `sections` list instead. Seeding zero entries into `subtotals` would
  quietly flip every `hasRows` gate.
- The header cell already tolerates a missing figure (renders „(0 poz.)").
- `row-ops.ts:80-93` already anticipates an existing section with no rows (`'reseed'`).
- Local DB (prod copy) has 0 itemless sections today. Turning visibility on surfaces nothing
  unexpected.

## What We're NOT Doing

- No placeholder row under the header, and no new synthetic id range. That was variant C's point.
- No change to the versions diff (`history/diff-versions.ts`). Adding or removing an itemless
  section shows no diff row.
- No extraction of the section handlers into a leaf hook under `editor/hooks/`. The handlers share
  `rowsRef`, `prevById` and `pruneByIds` with the item handlers, and splitting that cluster is
  EX-702's call. The new `sections` state sits next to `rows` in the root hook, **not** in
  `KosztorysEditorProvider` (EX-496).
- No bulk delete. EX-857 only gets a note that the cascade is gone.
- No sheet import, snapshot or szablon change. Those already create itemless sections.

## Implementation Approach

**Promote sections to first-class editor state.** `sections: SectionMetaT[]` (ordered
`{sectionId, sectionName, sectionColor}`) is seeded once from `tree.sections` by a pure
`treeToSections`, beside the mount-frozen `rows`. From then on it is the **only** source of section
order and section metadata.

- **`rows` stays items-only.** No fake section row goes into `rows`: it feeds the diff, totals and
  `prevById`, and a fake item would leak into all of them.
- **One invariant:** rows are contiguous blocks in `sections` order. `baseOrdinals`, subtotal order
  and `planKosztorysRenumber` all read row order. Any op that could break the invariant re-lays rows
  through `orderRowsBySections`. Two ops can: adding the first item to an itemless section, and a
  section swap.
- **Section writes update both.** Rename and colour patch `sections` _and_ the denormalized row
  copies. `before` is read from `sections`, which removes the no-op.
- **Undo.** Section commands are tagged `sectionHeaderRowId(sectionId)`. That negative-id namespace
  cannot collide with an item id. `handleRemoveSection` prunes it.
- **Visibility is one boolean.** `showItemless = !preview && !narrowed`, where `narrowed` means the
  search is non-empty or any condition is engaged. `buildSectionBandRows` emits a header-only band
  for an itemless section when the flag is on.

## Critical Implementation Details

- **Latest-value reads.** The „Dodaj → Praca" no-section path runs `handleAddSection()` and then
  `handleAddItem(newId)` in one handler. `handleAddItem` must resolve the section's meta from a
  `sectionsRef` (a latest-value ref, like `rowsRef`), never from the render closure. Otherwise the
  second call cannot see the section the first one just added.
- **Server actions run outside `setRows` / `setSections` updaters.** This is the existing rule. The
  swap rollback updates state; it does not fire another action.
- **Frozen columns.** The inline button reads `itemCount` from the header's `columnData.figures`
  (`figures.get(id)?.itemCount ?? 0`), not from a closure (lessons: per-row live state goes via row
  data or `columnData`).

---

## Phase 1: Pure section-list layer

### Overview

All section-order and band logic that the hook and the grid need, as pure functions under
`src/lib/kosztorys/`, with node unit specs. There are no editor changes yet, so every existing
caller must keep compiling.

### Changes Required

#### 1. Section list model + ops

**File**: `src/lib/kosztorys/section-list.ts` (new)

**Intent**: Model the ordered section list and the ops the hook needs. Keep row re-layout in one
place.

**Contract**:

- `SectionMetaT = Pick<KosztorysV2RowT, 'sectionId' | 'sectionName' | 'sectionColor'>`.
  `SectionMetaT` is cross-module, so it goes to `src/lib/kosztorys/types.ts` if that is where
  sibling row types live.
- `treeToSections(tree): SectionMetaT[]`, in `tree.sections` order.
- `insertSection(sections, meta, anchorId | null, dir)`. A `null` anchor means prepend, matching
  where `addSectionAction` places a section.
- `removeSection(sections, id) → {next, index}`.
- `restoreSection(sections, meta, index)`.
- `swapSection(sections, id, dir): SectionMetaT[] | null`. Returns null at the edge.
- `patchSection(sections, id, patch)`.
- `orderRowsBySections(rows, sections)`. A stable regroup of rows into `sections` order. Rows whose
  section is unknown stay at the end, in order.

#### 2. Bands: itemless header

**File**: `src/lib/kosztorys/section-band-rows.ts`

**Intent**: Iterate over the section list, not the row representatives. Emit a header-only band for
a section with no rows in view when `showItemless` is on. Keep skipping it when the flag is off.
Delete `sectionRepresentatives` once nothing reads it.

**Contract**: `OptsT = {enabled, collapsedSectionIds, sections: readonly SectionMetaT[],
showItemless: boolean}`.

**File**: `src/lib/kosztorys/synthetic-rows.ts`

**Intent**: `makeSectionHeaderRow` and `makeSectionFooterRow` accept a `SectionMetaT`. They already
read only those three fields.

#### 3. Move edges from the section list

**File**: `src/lib/kosztorys/move-edges.ts`

**Intent**: Derive `firstSectionId` / `lastSectionId` from `sections`, so an itemless section at
either end disables the right arrow. Item edges still come from rows.

**Contract**: `computeMoveEdges(rows, sections)`.

#### 4. Row ops that assumed "section = its rows"

**File**: `src/lib/kosztorys/row-ops.ts`

**Intent**:

- `catalogueSlicePlacement(sectionIds: ReadonlySet<number>, sectionId, createdSection)` checks list
  membership. `'fold'` covers any known section, itemless included. `'reseed'` covers an unknown
  one only.
- `applyAddItem` keeps its "after the section's last row" rule. The caller re-lays when the section
  had none.
- `applyInsertSectionRow`, `neighborSectionId` and `swapSectionBlock` are deleted once Phase 2 stops
  calling them. `applyKosztorysOrder` stays.

#### 5. Delete policy goes

**File**: `src/lib/kosztorys/delete-policy.ts` — deleted in Phase 2, together with its only caller.
Listed here so the Phase 1 unit specs do not re-cover it.

### Success Criteria

#### Automated Verification

- `section-list` unit spec covers each op, including `orderRowsBySections` placing the first item
  of a middle itemless section between its neighbours:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/section-list.test.ts`
- `section-band-rows` spec:
  - an itemless section yields a header and no footer when `showItemless` is on;
  - it yields nothing when the flag is off;
  - a collapsed populated section still yields its header only.

  Run: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-band-rows.test.ts`

- `move-edges` spec: an itemless first or last section owns the edge:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/move-edges.test.ts`
- `row-ops` spec: `catalogueSlicePlacement` folds into a known itemless section and reseeds only an
  unknown one: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-ops.test.ts`

#### Manual Verification

- None. The pure layer is fully covered by the specs.

---

## Phase 2: Sections as editor state + bare section create

### Overview

The hook owns `sections`, and every section handler writes it. The server stops seeding a first
item. The cascade goes. These land together because the hook is the only consumer of the
`{section, item}` action result.

### Changes Required

#### 1. Bare section on the server

**Files**: `src/lib/kosztorys/create-section.ts`, `src/lib/actions/kosztorys.ts` (our hunks only —
the file carries another agent's uncommitted description-cleanup edits)

**Intent**: `createSectionWithFirstItem` becomes `createSection` and inserts the section row only.
`addSectionAction` and `insertSectionAction` return `{section}`. Update the comments that cite the
old helper (`constants.ts:45`, `work-catalogue/create-section-with-catalogue-items.ts:52`) where
they state the seeding rationale.

**Contract**: `CreatedSectionT = {section: NewRowT}`, which replaces `CreatedSectionWithItemT`.

#### 2. DB integration fixtures

**Files**:

- `src/__tests__/lib/kosztorys/display-order.test.ts`
- `src/__tests__/lib/actions/kosztorys-lock.test.ts`
- `src/__tests__/lib/actions/kosztorys-renumber-kosztorys-order.test.ts`

**Intent**: Wherever a spec relied on the seeded item (`section.data.item`, "already seeded item
@0"), call `addItemAction(sectionId)` explicitly. Re-derive the display-order expectations; the
first explicit item now lands at order 0. Add one assertion that a fresh `addSectionAction` leaves
the section with zero items.

#### 3. Sections state in the root hook

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**:

- **State:** `const [sections, setSections] = useState(() => treeToSections(tree))` beside `rows`,
  plus `sectionsRef` as a latest-value ref.
- **Consumers switch to `sections`:**
  - `sectionRows` → `sections`;
  - `computeMoveEdges(rows, sections)`;
  - band `showItemless = !preview && search.trim() === '' && engagedConditionIds.size === 0`;
  - the hook returns `sections` and `showItemless`.
- **Item handlers:**
  - `handleAddItem` reads meta from `sectionsRef`, adds the row, and re-lays through
    `orderRowsBySections` when the section had no rows.
  - `handleInsertItem` samples its meta from `sectionsRef` too.
  - `handleRemoveItem` loses the cascade. Delete `delete-policy.ts` and its block in
    `kosztorys-v2-rows.test.ts:499-515`.
- **Section handlers:**
  - `handleAddSection` and `handleInsertSection` splice a meta into `sections` (name
    `DEFAULT_SECTION_NAME`, colour null) with no row. `handleAddSection` returns the new id.
    `buildNewSectionRow` goes.
  - `handleReorderSection` / `applySectionSwap` / `persistSectionSwap` swap in `sections`, re-lay
    rows, and roll back the same way. `touchedIds` is `[sectionHeaderRowId(id), ...itemIds]`.
  - `handleRemoveSection` removes the entry from both states, prunes
    `sectionHeaderRowId(id)` + item ids, and on rejection restores the meta at its old index and
    re-lays the rows.
  - `applySectionField` patches `sections` _and_ the rows.
  - `handleSetSectionField` reads `before` from `sectionsRef`.
  - `pushReversible` gains an optional `touchedIds`, which section rename and colour pass.
- **Appends:**
  - `handleAppendedSections` (szablon) appends every slice section to `sections`, itemless ones
    included.
  - `handleAppendedCatalogueItems` prepends a created section's meta, and re-lays after a fold into
    an itemless section.

**Contract**: the hook return gains `sections: SectionMetaT[]` and `showItemless: boolean`.
`handleAddSection: () => Promise<number | undefined>`. `sectionRows` is removed from the return.

#### 4. Remount token

**File**: `src/components/kosztorys/editor/kosztorys-editor-v2.tsx`

**Intent**: `treeToken` also carries `tree.sections.length`. Another tab adding or removing an
itemless section then reseeds the editor.

#### 5. Editor body wiring (non-visual)

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx` (another agent has a 1-line
uncommitted edit here; edit only our hunks)

**Intent**:

- `buildSectionBandRows(viewRows, {..., sections, showItemless})`.
- The owner's „… jest pusty" empty state keys on `sections.length === 0`. The client's keys on
  `subtotals.length === 0`.
- The two sibling states („Brak wyników", filter-emptied) use the same `isEmpty` gate, so an
  itemless-only kosztorys under a search still says „Brak wyników".
- `hasRows` props stay on `subtotals`.

### Success Criteria

#### Automated Verification

- renderHook DOM spec (new; pattern: `use-kosztorys-catalogue-problems.test.tsx`, actions mocked):
  - a tree with an itemless section exposes it in `sections`;
  - removing a section's last item leaves the section in `sections` and calls no
    `removeSectionAction`;
  - `handleAddSection` adds a meta and no row;
  - adding the first item into a middle itemless section lands its row between its neighbours'
    blocks;
  - rename of an itemless section updates `sections` and calls `updateSectionFieldAction`;
  - after `handleRemoveSection`, the section's earlier rename/reorder commands are pruned from undo.

  Run: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/use-kosztorys-itemless-sections.test.tsx`

- DB integration: fresh `addSectionAction` / `insertSectionAction` create zero items, and the
  updated fixtures pass: `pnpm test:integration`
- `pnpm typecheck` passes. It is the gate for the deleted `delete-policy.ts`, `buildNewSectionRow`,
  `neighborSectionId` / `swapSectionBlock` / `applyInsertSectionRow` and `sectionRepresentatives`.

#### Manual Verification

- On local dev (docker DB), „Dodaj → Sekcja" shows a new header band with no row under it. A reload
  keeps it.
- Deleting the last pozycja of a section leaves its band. A reload keeps it.

---

## Phase 3: Itemless section UI

### Overview

The affordances variant C calls for: an inline „+ Dodaj pracę" on the header of an itemless
section, „Dodaj pracę" in every section's ⋯ menu, and the add-menu and catalogue-picker lists
reading `sections`.

### Changes Required

#### 1. Header band

**File**: `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx`

**Intent**: When `(figures.get(id)?.itemCount ?? 0) === 0` and `actions` is present, render an
inline „+ Dodaj pracę" button after the name that calls `actions.onAddItem(sectionId)`. In that
state, render no chevron and don't toggle collapse on a band click. Behaviour for a populated
section is unchanged.

**Contract**: `SectionBandActionsT` gains `onAddItem: (sectionId: number) => void`.

#### 2. Section ⋯ menu

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx`

**Intent**: Add a „Dodaj pracę" item beside „Dodaj pracę z katalogu do sekcji…", available for
every section. It is not gated by sort: it appends at the section's end, which is not an ordering
command.

#### 3. Actions bundle

**Files**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`, `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts` (if the handler threads through column opts)

**Intent**: The `sectionHeader` memo's `actions` bundle carries `onAddItem: editorOnly(handleAddItem)`.
Under `readOnly` the bundle is undefined as today, so no button renders.

#### 4. „Dodaj" menu + catalogue picker

**Files**:

- `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx`
- `src/components/kosztorys/editor/actions/catalogue-picker-host.tsx`
- `src/lib/kosztorys/work-catalogue/section-target.ts`
- the dialog prop type in `AddItemsFromCatalogueDialog`

**Intent**:

- The „Praca" submenu lists `sections`.
- With no sections, „Praca" runs `handleAddSection()` then `handleAddItem(id)`. An itemless
  leftover after a failed second call is now a legitimate state.
- Update the menu's comment that cites the seeded first item.
- The catalogue picker passes `sections`.
- `sectionNameOptions` / `resolveSectionTarget` take `readonly SectionMetaT[]` instead of
  `SectionSubtotalT[]`.
- The „Sekcje" collapse menu stays on `subtotals`, because collapse is meaningless without items.

### Success Criteria

#### Automated Verification

- `section-header-cell` DOM spec:
  - an itemless section renders „Dodaj pracę", no chevron, and a band click does not toggle
    collapse;
  - clicking the button calls `onAddItem(sectionId)`;
  - a populated section renders no button.

  Run: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/cells/section-header-cell.test.tsx`

- `section-target` unit spec: an existing itemless section name resolves to that section, not to
  „nowa sekcja". Extend `src/__tests__/lib/kosztorys/work-catalogue/section-target.test.ts`.
- `pnpm typecheck && pnpm lint`

#### Manual Verification

- „+ Dodaj pracę" on an itemless band adds a pozycja under it. The button disappears and the chevron
  appears.
- ⋯ → „Dodaj pracę" on a populated section appends a pozycja at its end.
- „Dodaj → Praca" on a kosztorys with no sections creates a section with one pozycja.
- A search or „Filtry" condition hides the itemless band. Clearing it brings the band back.
- „Podgląd dla inwestora" shows no itemless band.

---

## Phase 4: E2E specs + docs

### Overview

Bring the browser specs in line with the new creation and deletion behaviour, and record the rule.
**E2E specs are edited, not run.** A run is owed only on explicit request.

### Changes Required

#### 1. E2E specs

**Files**:

- `e2e/kosztorys-section-headers.spec.ts:50`
- `e2e/kosztorys-structure.spec.ts` (`:137`, `:197`, `:276` — „Dodaj → Praca")
- `e2e/kosztorys-deletes.spec.ts:103-120`

**Intent**:

- Anywhere a spec relied on a new section arriving with a blank row, add the row through „+ Dodaj
  pracę".
- The last-item delete test now asserts the section band **stays**.
- Add one flow: bare section → header shows „+ Dodaj pracę" → click → row appears.

#### 2. Docs

**Files**:

- `context/reference/kosztorys-editor-domain-notes.md` — **append only**; another agent has
  uncommitted edits here.
- `context/changes/2026-09-23-kosztorys-bulk-actions/research.md`

**Intent**:

- Domain notes get a short „Sekcja bez pozycji" entry:
  - created bare;
  - survives its last item's delete;
  - header-only band with „+ Dodaj pracę";
  - hidden under search/filters and in every client output;
  - why it is named „bez pozycji", not „pusta".
- The EX-857 research gets a dated note at `:210-216`: the cascade is gone, so bulk delete must not
  generalize `isLastItemInSection`.

### Success Criteria

#### Automated Verification

- The E2E specs typecheck (`pnpm typecheck` covers `e2e/`). The specs are **not** executed.

#### Manual Verification

- None beyond Phase 3's.

---

## Testing Strategy

The cheapest layer that sees each risk:

- **Node:** ordering and band logic in `section-list`, `section-band-rows`, `move-edges`,
  `row-ops` and `section-target`.
- **jsdom renderHook:** the hook's state transitions, especially the ones that can't be seen from
  pure functions: no cascade, re-layout on first item, undo pruning, and latest-value reads across
  add-section → add-item.
- **jsdom component:** the header button and chevron.
- **DB integration:** bare creation on the server.
- **E2E:** edited to match, and run only on explicit request.

## Performance Considerations

`orderRowsBySections` is O(n). It runs only on a section swap or a first-item add, not per
keystroke. `sections` is a separate state from `rows`, so cell edits don't recompute anything
section-level beyond what they already do. Nothing moves into the provider.

## Migration Notes

None. There is no schema change. Existing data has 0 itemless sections.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`

## References

- Research + decisions: `context/changes/2026-09-29-kosztorys-empty-section/research.md`
- Conflicting plan: `context/changes/2026-09-23-kosztorys-bulk-actions/research.md:210-216` (EX-857)
- History:
  - `6b44f8fd` — first-item seed;
  - EX-578 `40ffc71b` — section + item in one transaction;
  - EX-463 — wedged cold start. It is guarded here by keying the empty state on `sections`.
- Lessons:
  - `context/foundation/lessons.md:154` — live per-row state via row data or `columnData`;
  - `:167-169` — `patchRows`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure section-list layer

#### Automated

- [x] 1.1 `section-list` unit spec covers each op, incl. `orderRowsBySections` placing a middle itemless section's first item between its neighbours — 5bbc2499
- [x] 1.2 `section-band-rows` spec: itemless → header only when `showItemless`, nothing when off; collapsed populated → header only — 5bbc2499
- [x] 1.3 `move-edges` spec: an itemless first/last section owns the edge — 5bbc2499
- [x] 1.4 `row-ops` spec: `catalogueSlicePlacement` folds into a known itemless section, reseeds only an unknown one — 5bbc2499

### Phase 2: Sections as editor state + bare section create

#### Automated

- [x] 2.1 renderHook spec: itemless section in `sections`; last-item delete keeps the section; add section = meta, no row; first item re-lays between neighbours; itemless rename persists; section delete prunes its undo commands — 1edb9aa0
- [x] 2.2 DB integration: `addSectionAction` / `insertSectionAction` create zero items; updated fixtures pass (`pnpm test:integration`) — 1edb9aa0
- [ ] 2.3 `pnpm typecheck` passes with `delete-policy.ts`, `buildNewSectionRow`, `neighborSectionId`, `swapSectionBlock`, `applyInsertSectionRow`, `sectionRepresentatives` removed

### Phase 3: Itemless section UI

#### Automated

- [ ] 3.1 `section-header-cell` DOM spec: itemless → „Dodaj pracę", no chevron, no collapse toggle; click calls `onAddItem`; populated → no button
- [ ] 3.2 `section-target` unit spec: an existing itemless section name resolves to that section
- [ ] 3.3 `pnpm typecheck && pnpm lint`

### Phase 4: E2E specs + docs

#### Automated

- [ ] 4.1 E2E specs updated and typecheck (not executed)
