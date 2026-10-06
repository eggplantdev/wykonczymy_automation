# EX-999 — „Ustaw kolejność”: Implementation Plan

## Overview

A dialog in the kosztorys / szablon editor that rearranges the whole sheet in one pass:

- select rows by click, Shift-range or a whole section;
- drag the selected block anywhere, across sections too;
- drag sections;
- save the whole layout once, with an auto-version.

A spike of it is already in the working tree, uncommitted. This plan hardens that spike rather than rebuilding it.

## Current State Analysis

- **Today's only move** is ▲▼ from a row's ⋯ menu: one row, one step, within its section (`moveRowOneStep`, `src/lib/kosztorys/display-order.ts`). For a szablon of ~400 prac that is the "takes forever" the owner reported. Moving a row to another section is not possible at all.
- **Spike files, all uncommitted:**
  - `src/lib/db/kosztorys-layout.ts`: `kosztorysLayoutSchema`, `LAYOUT_STALE`, `writeKosztorysLayout`. It locks the sections and items in id order, checks that the layout is an exact permutation, writes both orders with VALUES-join UPDATEs, and bumps `investments.updated_at`.
  - `src/lib/actions/kosztorys.ts`: `writeKosztorysLayoutAction`, built on `investmentAction`.
  - `src/lib/kosztorys/reorder-layout.ts`: the pure functions `moveItems`, `moveSection`, `sameLayout`.
  - `src/components/kosztorys/editor/dialogs/reorder/reorder-dialog.tsx`: the dialog, with native HTML5 drag and drop delegated on the scroll container.
  - `src/components/kosztorys/editor/actions/reorder-action.tsx`: the menu item.
  - The `reorder` toggle in `kosztorys-actions-context.tsx`, wired into `kosztorys-actions-menu.tsx`.
- **What the spike has proven:** typecheck and lint pass. Its SQL has never run against a database, and nothing has been tested in a browser.
- **Gaps:**
  1. **Snapshot placement.** `captureAutoSnapshot` runs before validation and outside the transaction, so a refused (stale) write still leaves a version in „Wczytaj”. Lesson „A server write into cells the grid also autosaves” puts it inside the transaction, after the stale check and before any tree write.
  2. **Pending cell saves.** A save reseeds the grid through `onTreeReplaced`. A cell typed just before it, still debounced or in flight, then shows its pre-edit value until the next reload. `drain(keys)` (`save-lanes.ts`) can only flush named lanes; there is no way to flush every lane.
  3. **No section colour** on the list.
  4. **No tests.**

### Key Discoveries

- `useDebouncedSave` returns `drain`, and `use-kosztorys-editor.ts:200` already destructures it. `use-worker-report-acceptance.ts:51-53` is the precedent: `flushUndoBuffer()` then `await drain(keys)` before the action.
- The editor body spreads `...editor` into `KosztorysEditorProvider` (`kosztorys-editor-body.tsx:467`), so anything the hook returns reaches `useKosztorysEditorContext()`. The function `useState` creates for `saves` is stable, so this adds no value-identity churn (EX-496).
- `reseed()` (`kosztorys-editor-v2.tsx:43-50`) already resets undo/redo and skips the next auto-snapshot. An undo policy of "snapshot-only" therefore needs no new code.
- **The item number is not positional.** `ref` (EX-949) is a stable per-item number, so a cross-section move leaves the paper forms valid.
- **Section colour:** `SectionMetaT` carries `sectionColor`. `sectionColorRail(color)` (`src/lib/kosztorys/section-colors.ts`) is the class helper the grid and `review-lines-table.tsx` use.
- **Test precedents:**
  - DB: `src/__tests__/lib/db/kosztorys-item-texts.db.test.ts` and `src/__tests__/lib/kosztorys/item-ref.db.test.ts`, with the helpers `createTestInvestment` and `createKosztorysTree`.
  - Lanes: `src/__tests__/lib/kosztorys/save-lanes.test.ts`.

## Desired End State

The owner opens „Opcje → Ustaw kolejność…” on a szablon of 300+ prac and selects any set of rows. They drag the set into another section or click „Przenieś tutaj”, drag sections, and save.

- One write lands.
- The grid shows the new order, and every cell typed before the save keeps its value.
- „Wczytaj” holds one auto-version from before the save.
- A save that conflicts with another tab is refused with `LAYOUT_STALE` and leaves no version.

## What We're NOT Doing

- **Ctrl+Z for a reorder.** Recovery is the auto-version, the same as „Wyczyść” and „Popraw literówki”.
- **Keyboard moves** (Alt+↑/↓).
- **Search on the list.**
- **Custom auto-scroll while dragging.** Chromium scrolls a scrollable container near its edge natively; the manual check confirms this.
- **Reordering in the grid itself.** The bulk selection in the grid is EX-857, a different surface.
- **A Playwright spec now.** It is deferred to an `e2e-backlog` issue.

## Implementation Approach

- **Phase 1** hardens the server side, because the spike's SQL has never run and everything else rests on it.
- **Phase 2** adds the one missing primitive, "flush every lane", and wires the dialog to await it.
- **Phase 3** is the polish and the browser-facing guard.

## Phase 1: Layout write — correctness and tests

### Changes Required

#### 1. Split check from write

**File**: `src/lib/db/kosztorys-layout.ts`

**Intent**: the action must take the snapshot between "the layout is a valid permutation" and "the tree is written", inside one transaction.

**Contract**:

- `lockAndCheckLayout(db, investmentId, layout): Promise<boolean>` takes the same `FOR UPDATE` locks in ascending-id order and runs the permutation check.
- `applyLayout(db, investmentId, layout): Promise<void>` runs both VALUES-join UPDATEs plus the `investments.updated_at` bump.
- `writeKosztorysLayout` is removed; it would have no remaining caller.
- Both UPDATEs stay scoped by `investment_id`.

#### 2. Action order

**File**: `src/lib/actions/kosztorys.ts` (`writeKosztorysLayoutAction`)

**Intent**: a refused write leaves no auto-version.

**Contract**: validate, then `withPayloadTransaction`, then inside it:

1. `lockAndCheckLayout(tx)`; if false, return `{ success: false, error: LAYOUT_STALE }`;
2. `captureAutoSnapshot(tx, investmentId, user.id)`;
3. `applyLayout(tx)`.

Tags stay `['kosztorysSections', 'kosztorysItems']`, and `skipRevalidation: true` stays.

### Success Criteria

#### Automated Verification

- Unit spec `src/__tests__/lib/kosztorys/reorder-layout.test.ts`:
  - `moveItems` keeps the block's top-to-bottom order when its rows come from two sections;
  - dropping the block before one of its own rows is a no-op;
  - a missing `beforeItemId` appends at the section's end;
  - an unknown target section returns the layout unchanged;
  - `moveSection` places a section before a given section, and at the end when none is given.
- DB spec `src/__tests__/lib/db/kosztorys-layout.db.test.ts`, run through `writeKosztorysLayoutAction` and asserting persisted rows:
  - a cross-section move persists both the new `section_id` and a contiguous `display_order` per section;
  - section order persists;
  - a layout missing an item, carrying an extra id, or carrying another investment's id is refused with `LAYOUT_STALE`;
  - after a refusal the rows are unchanged and no new auto-snapshot exists;
  - a successful write adds exactly one auto-snapshot and bumps `investments.updated_at`.

---

## Phase 2: Flush every pending cell save before the write

### Changes Required

#### 1. Lanes

**File**: `src/lib/kosztorys/save-lanes.ts`

**Intent**: wait for every write the editor has queued, whatever its key.

**Contract**:

- `createSaveLanes` gains `drainAll(): Promise<void>`, which awaits every current tail.
- `createDebouncedSaves` gains `drainAll()`, which first FIRES every pending timer, the same as `drain` does, and then awaits `lanes.drainAll()`.
- `useDebouncedSave` returns it.

#### 2. Editor seam

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: a whole-tree action can make the server catch up with the screen before writing.

**Contract**: the hook returns `flushPendingSaves(): Promise<void>`, which is `flushUndoBuffer()` followed by `await drainAll()`. It reaches the dialog through `useKosztorysEditorContext()`. Nothing is added to `KosztorysEditorProvider` itself.

#### 3. Dialog save

**File**: `src/components/kosztorys/editor/dialogs/reorder/reorder-dialog.tsx`

**Contract**: the save handler awaits `flushPendingSaves()` before `settleTreeReplace(...)`.

### Success Criteria

#### Automated Verification

- `src/__tests__/lib/kosztorys/save-lanes.test.ts` gains three cases:
  - `drainAll` fires a pending debounced save immediately rather than dropping it;
  - `drainAll` resolves only after in-flight writes on two different keys have settled;
  - with nothing queued, it resolves at once.

---

## Phase 3: Dialog polish and verification

### Changes Required

#### 1. Section colour

**File**: `reorder-dialog.tsx`

**Contract**: each section header row carries `sectionColorRail(section.sectionColor)`, the same rail the grid draws.

#### 2. E2E backlog

File a Linear issue labelled `e2e-backlog` in project „Wykonczymy”. Its scope: drag a two-section block into a third section, drag a section, save, and check that the grid order survives a reload. Record its id in `change.md`.

### Success Criteria

#### Automated Verification

- DOM spec `src/__tests__/components/kosztorys/editor/dialogs/reorder/reorder-dialog.test.tsx`, with the action mocked via `vi.mock` and the editor context provided:
  - a click and then a Shift-click select the range;
  - the section checkbox selects every row of the section, and a partial selection shows as indeterminate;
  - „Przenieś tutaj” on another section, then „Zapisz kolejność”, calls the action with the moved rows at that section's end, in their original order;
  - „Zapisz kolejność” is disabled while the layout is unchanged;
  - the save awaits `flushPendingSaves` before calling the action.

#### Manual Verification

On szablon 165 (310 prac), locally:

- select rows from two sections with Shift and drag them into a third;
- drag a section to the top;
- fold the sections and drop onto a folded header;
- dragging near the list's bottom edge scrolls it;
- save → the grid shows the new order, and a cell typed just before opening the dialog keeps its value;
- „Wczytaj” lists one new auto-version, and restoring it brings the old order back.

---

## Testing Strategy

Each risk is guarded at the cheapest layer that gives a real signal:

- **Node (pure move logic):** block order and anchor resolution.
- **DB:** the permutation guard, the cross-section write, and snapshot-only-on-success. These are the risks a mocked spec cannot see.
- **jsdom:** selection semantics, and the client → action layout contract.
- **Manual and E2E backlog:** real drag and drop.

## Performance Considerations

At 400 items the write is two UPDATE statements: one VALUES row per section and one per item. That is far below the cost of the existing per-row ▲▼ round trips. The dialog renders every row without virtualisation; 400 plain rows are fine, and the manual check at 310 confirms it.

## Whole-tree Gate

- Typecheck: `pnpm typecheck`.
- Lint: `pnpm lint`.
- Touched specs: `pnpm exec vitest run <file>` for each new or changed spec. The full `pnpm test` and `pnpm test:integration` run only when the user asks.

## References

- Decisions: `context/changes/2026-10-06-kosztorys-reorder-dialog/change.md`.
- Related: `context/changes/2026-09-23-kosztorys-bulk-actions/research.md` (EX-857).
- Lessons:
  - „A server write into cells the grid also autosaves: drain those lanes first…”;
  - „An undo's inverse write races the forward autosave…”.
- Precedents:
  - `src/components/kosztorys/editor/hooks/use-worker-report-acceptance.ts:51-53`;
  - `src/lib/actions/accept-worker-report.ts:241`;
  - `src/__tests__/lib/db/kosztorys-item-texts.db.test.ts`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Layout write — correctness and tests

#### Automated

- [x] 1.1 reorder-layout unit spec — 0814181d
- [x] 1.2 kosztorys-layout DB spec (cross-section move, stale refusal, snapshot only on success) — 0814181d

### Phase 2: Flush every pending cell save before the write

#### Automated

- [x] 2.1 save-lanes drainAll unit cases

### Phase 3: Dialog polish and verification

#### Automated

- [ ] 3.1 reorder-dialog DOM spec
- [ ] 3.2 e2e-backlog issue filed and recorded in change.md
