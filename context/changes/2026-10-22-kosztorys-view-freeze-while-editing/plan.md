# Freeze the kosztorys view while editing — Implementation Plan

## Overview

EX-1114. While a sort, a search phrase or a row/stage condition narrows the kosztorys editor, an edit
can reorder or remove the row (or stage column) under the cursor mid-typing, and react-datasheet-grid
keeps the active cell by index — the next keystroke lands in another pozycja. Generalise the existing
condition latch into one view latch that freezes the view's **membership, order and stage-column set**
until a deliberate action recomputes it.

## Current State Analysis

- `buildViewRows` (`src/lib/kosztorys/row-view.ts:59-110`) runs search → conditions → sort on every
  `rows` change. Cells write per keystroke, so a sorted column re-sorts as you type.
- `useConditionRowLatch` (`src/components/kosztorys/editor/hooks/use-condition-row-latch.ts`) holds a
  growing `Set<number>` of every rendered row id, keyed on the engaged latching condition ids + a
  refresh counter. `applyRowConditions` lets a latched row pass the conditions
  (`row-conditions/queries.ts:23-38`). It is enabled only while a latching condition is engaged.
- The latch deliberately skips search (`row-view.ts:89-90`) and does nothing for order.
- Release: `refreshProblemRows` bumps the counter when „Problemy" or „Filtry" opens
  (`kosztorys-problems-menu.tsx:39`, `kosztorys-filters-menu.tsx:24`); „Tylko zgłoszone” releases by
  toggling (it changes the engaged ids).
- New pozycje are held via `holdNewRow` (`use-kosztorys-editor.ts:272`, used by `use-item-ops.ts:82`
  and `use-section-crud.ts:147`). Under a sort, „wstaw nad/pod" is disabled (`orderCommandsEnabled`);
  only „dodaj na końcu sekcji" stays.
- Stage columns: `buildV2Grid` keeps only `stagesMatchingEngaged(viewStages, engagedStageConditionIds,
{ scaledDownStageIds })` (`kosztorys-v2-columns.tsx:131`). `scaledDownStageIds` comes from
  `subcontractorDueByPlane(rows, stages)`; `splitStagePool` flags an amount-mode split as scaled down
  while Σ entered amounts > the etap's pool (`stage-split.ts:37`). Raising qty or cena in that etap
  drops its column mid-typing. The other two stage conditions read only etap settings.
- „Zapisz kolejność" (`use-item-ops.ts:137-152`) renumbers from `rowsRef.current` with a **fresh** sort,
  not from what is rendered.
- Section folding was checked and is not affected: `foldableSectionIds` only feeds the „Sekcje" menu.

## Desired End State

While any of sort / search / a latching condition is active, the view built at the last deliberate
action stays put as cells are edited: no row leaves, no row moves, no stage column leaves. Rows that
newly qualify (a new pozycja, an undo) still join — at the end of their sekcja under a section-scoped
sort, at the end of the list under a global one. The view recomputes on: picking a sort item (even
the one already active), clearing the sort, changing the search phrase, opening „Problemy"/„Filtry",
toggling any condition („Tylko zgłoszone” included), switching the price view, and „Zapisz kolejność".

### Key Discoveries:

- The latch already proves the pattern: state keyed by its inputs, reset by a key change, ids recorded
  after each build (`use-kosztorys-editor.ts:554-566`).
- `SortMenuItems` calls `onSort` with a fresh object even for the active pick
  (`sort-menu-items.tsx:24`) — keying the latch on the sort object's identity makes "pick it again"
  the re-sort action with no new UI.
- `buildV2Grid` does not expose which stages it showed; it has to, for the hook to latch them.

## What We're NOT Doing

- No "stale order" indicator or new „Odśwież" button — re-picking the sort is the refresh.
- No change to list tables (transfers, leads, zgłoszenia) — no inline typing, server-side sort.
- No change to section folding.
- No change to react-datasheet-grid's index-based active cell.

## Implementation Approach

Push the freeze into the pure layer: `buildViewRows` and `stagesMatchingEngaged` take the latch as
input and become the single place that honours it. The hook only owns the latch's lifetime (key,
reset, recording). One latch object carries row ids, row ranks and stage ids under one key.

## Critical Implementation Details

- **Ordering under a frozen sort:** rank-ordered rows first, unranked rows after them, the unranked
  keeping their fresh sorted order among themselves. Under `scope: 'section'` this happens per
  sekcja (groups from `groupBySection` keep section order). After the build, every unranked id in the
  output gets the next rank, so the next build reproduces the same order.
- **„Zapisz kolejność" must refresh the latch** in the same handler, or the saved order (fresh sort)
  differs from the one on screen.

## Phase 1: Pure layer honours the latch

### Overview

`buildViewRows` and `stagesMatchingEngaged` accept a latch and freeze membership, order and stage
set. Test-first.

### Changes Required:

#### 1. View latch type + `buildViewRows`

**File**: `src/lib/kosztorys/row-view.ts`

**Intent**: Replace `latchedRowIds` with a `latch` input. Latched rows bypass the search as well as the
conditions; under a sort, order follows the latch's ranks with unranked rows appended per the rule
above. Rewrite the comment at lines 89-90, which states the opposite.

**Contract**: `export type ViewLatchT = { ids: ReadonlySet<number>; rank: ReadonlyMap<number, number> }`;
`buildViewRows({ …, latch?: ViewLatchT })`. Without a latch, output is identical to today.

#### 2. Search bypass

**File**: `src/lib/kosztorys/row-view.ts`

**Intent**: `filterRows` keeps a row whose id is latched, mirroring `applyRowConditions`.

**Contract**: `filterRows(rows, query, latchedIds?: ReadonlySet<number>)`.

#### 3. Stage set

**File**: `src/lib/kosztorys/stage-conditions.ts`

**Intent**: A latched etap stays among the shown stages even when no engaged condition matches it.

**Contract**: `stagesMatchingEngaged(stages, engagedIds, context, latchedStageIds?: ReadonlySet<number>)`;
with no engaged condition, still returns all stages.

### Success Criteria:

#### Automated Verification:

- Red first, then green: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view.test.ts` —
  sorted column edited under a frozen rank keeps the id order (section and global scope); an unranked
  row lands at the end of its sekcja / the list; a latched row that stops matching the search stays;
  no latch → today's output.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/stage-conditions.test.ts` — a latched etap that
  stopped matching „z podziałem do poprawienia" stays shown.
- Existing `row-view*.test.ts` stay green.

#### Manual Verification:

- None for this phase (no UI wired yet).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: One view latch in the editor

### Overview

Generalise the hook, wire it through the editor, the grid and „Zapisz kolejność".

### Changes Required:

#### 1. Latch hook

**File**: `src/components/kosztorys/editor/hooks/use-condition-row-latch.ts` → rename to
`use-view-latch.ts`, `useViewLatch`

**Intent**: Key the latch on the latching condition ids, the trimmed search phrase, the sort object's
identity, the price view and the refresh counter. Enabled while any of sort / search / a latching
condition is active. Holds row ids, row ranks and stage ids.

**Contract**: `useViewLatch({ conditionIds, search, sort, view }) → { latch: { ids: Set<number>;
rank: Map<number, number>; stageIds: Set<number> } | null; refresh: () => void }`.

#### 2. Editor wiring

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Pass the latch to `buildViewRows`; after the build, record ids and assign ranks to
unranked ids in output order. Pass `latchedStageIds` into `columnOpts` and record the stages the grid
showed. `holdNewRow` keeps adding to `latch.ids`. Rename `refreshProblemRows` → `refreshView` (it is
no longer about problems) in the two menus that call it.

**Contract**: `columnOpts.latchedStageIds?: ReadonlySet<number>`; `buildV2Grid` returns
`shownStageIds: number[]` beside `columns`.

#### 3. Grid

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`,
`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`

**Intent**: Forward `latchedStageIds` to `stagesMatchingEngaged`; return the shown stage ids.

#### 4. „Zapisz kolejność"

**File**: `src/components/kosztorys/editor/hooks/use-item-ops.ts`

**Intent**: Refresh the view latch when the order is persisted, so the screen shows what was saved.

**Contract**: `useItemOps` takes `refreshView: () => void`.

#### 5. Retired comments

**Files**: `src/lib/kosztorys/problem-conditions.ts` (`LATCHING_IDS` doc), the hook's own doc

**Intent**: State the release actions for search and sort beside the existing ones.

### Success Criteria:

#### Automated Verification:

- Red first: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/use-kosztorys-editor-view-freeze.test.tsx`
  — with a search phrase set, editing a visible pozycja's opis so it no longer matches keeps it in
  `viewRows`; changing the phrase re-filters it out.
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/hooks/use-view-latch.test.tsx` — a new
  sort object with the same field/dir/scope resets the latch; an unchanged one keeps it; no active
  input → `latch: null`.
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/use-kosztorys-editor-reported-only.test.tsx`
  and `use-kosztorys-editor-memoization.test.ts` stay green.

#### Manual Verification:

- Kosztorys editor, sort „Przedmiar" rosnąco zachowując sekcje: type a two-digit value into Przedmiar
  of a pozycja — the row stays and the cursor stays on it; picking the same sort again moves it.
- Same with „Sortuj rosnąco" (global).
- Search „płyt", change the opis of a matching pozycja to something without „płyt": it stays while
  typing; editing the search phrase removes it.
- „Problemy" → „Etapy z podziałem do poprawienia" on an etap with a kwotowy podział: raise its qty past
  the split — the etap's column stays; reopening „Problemy" removes it.
- Under a stale sort, „Zapisz kolejność": the view re-sorts to the saved order.
- Under a sort, „Dodaj pozycję" at the end of a sekcja: the new pozycja appears at the end of that
  sekcja and stays there while you fill it.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `buildViewRows` with a latch: order freeze (both scopes), unranked placement, search bypass,
  no-latch parity.
- `stagesMatchingEngaged` with latched stage ids.

### Integration Tests:

- Hook-level (`dom` project, `renderHook(useKosztorysEditor)` as in
  `use-kosztorys-editor-reported-only.test.tsx`): search freeze end to end.
- `useViewLatch` key/reset behaviour.

### Manual Testing Steps:

See Phase 2 manual verification.

## Performance Considerations

The rank sort is one extra O(n log n) pass over the already-built view (~1000 pozycji) inside the
existing `viewRows` memo — no new per-keystroke scans.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Issue: EX-1114
- Prior point fixes: `7745dbbb7` („Filtry"), `7e3555ec8` („Tylko zgłoszone”)
- Pattern: `src/components/kosztorys/editor/hooks/use-condition-row-latch.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure layer honours the latch

#### Automated

- [x] 1.1 row-view-latch spec red, then green — 3dfe5e15b
- [x] 1.2 stage-conditions spec covers latched etapy — 3dfe5e15b
- [x] 1.3 existing row-view specs green — 3dfe5e15b

### Phase 2: One view latch in the editor

#### Automated

- [x] 2.1 view-freeze editor spec red, then green — (this commit)
- [x] 2.2 use-view-latch spec green — (this commit)
- [x] 2.3 reported-only and memoization specs green — (this commit)
