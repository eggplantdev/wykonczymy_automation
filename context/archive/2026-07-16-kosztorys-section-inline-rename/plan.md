# Kosztorys Section Inline Rename Implementation Plan

## Overview

Make the grid's **Sekcja** cell editable so typing in it renames the whole section, instead of the
cell being read-only and forcing the user to the section panel. The rename fans out to every row of
the section (the name is a denormalized field) and persists server-side — logic that already exists
in `handleRenameSection`. This change only exposes that handler to the grid and swaps the disabled
cell for an editable one.

## Current State Analysis

- The **Sekcja** column is hard-disabled: `src/lib/tables/kosztorys-v2-columns.tsx:587-595` builds it
  as `keyCol('sectionName', textColumn, { ..., disabled: true })`. The inline comment states the name
  is changed "only from the panel — a per-row edit would change only this row's copy."
- `handleRenameSection(sectionId, name)` already does the right thing
  (`src/components/kosztorys/use-kosztorys-editor.ts:499`): it overwrites `sectionName` on every row
  of the section in `rows` **and** `prevById.current` (so the grid's diff sees no per-row change),
  then persists via `updateSectionFieldAction(sectionId, { name })`.
- It is already wired to the section panel:
  `kosztorys-editor-body.tsx:92` passes `onRenameSection={handleRenameSection}` into
  `KosztorysSectionSummary`, which commits on blur/Enter (`kosztorys-section-summary.tsx:62`).
- The grid's columns are built from `columnOpts` in `use-kosztorys-editor.ts:157-177`.
  `handleRenameSection` is defined in the same hook (line 499), so it is already in scope at the
  `columnOpts` construction site — exposing it is a one-line add.
- Existing custom, self-managing cells to model after: `UnitCell` (`kosztorys-v2-columns.tsx:320`)
  and `DiscountValueCell` (line 292) — plain column objects (not `keyColumn`) with a `component`,
  `keepFocus`, `copyValue`, `deleteValue`.
- The row carries `sectionId` (that is what `handleRenameSection` matches on).

## Desired End State

Clicking into any **Sekcja** cell and typing, then blurring or pressing Enter, renames the entire
section: every row in the section shows the new name immediately, the section panel reflects it, and
the name survives a page reload. Escape cancels the in-progress edit. The change is verifiable in the
browser and by re-reading the row after reload.

### Key Discoveries:

- The server + fan-out path is already built and correct — no action, no schema, no hook work.
  (`use-kosztorys-editor.ts:499`, `updateSectionFieldAction`)
- The commit must **not** go through the grid's per-row `setRowData`/autosave — that would write only
  one row's denormalized copy. It must call `opts.onRenameSection(rowData.sectionId, name)` directly,
  exactly as the panel does. This is the whole reason the cell can't stay a `keyColumn`.
- Self-managing custom cells already exist in this file (`UnitCell`, `DiscountValueCell`) — the new
  cell follows that shape, so no new dsg pattern is introduced.

## What We're NOT Doing

- Not adding an empty-name guard. Per the decision, an explicit clear-and-commit is allowed to persist
  an empty section name (diverges from the panel, which rejects empty — see Open Risks).
- Not touching `handleRenameSection`, `updateSectionFieldAction`, the schema, or any Payload hook.
- Not writing the Playwright E2E now — deferred to the `e2e-backlog` (see Testing Strategy).
- Not changing the section panel's rename affordance — both entry points coexist.
- Not restyling the column, changing its width, hide/resize behavior, or its position.

## Implementation Approach

Replace the disabled `sectionName` `keyCol` with a plain column object whose `component` is a new
`SectionNameCell` — a self-managing input with local draft state seeded from `rowData.sectionName`,
committing to `opts.onRenameSection(rowData.sectionId, draft)` on blur and Enter, reverting on Escape.
Expose `onRenameSection` on `BuildV2ColumnsOptsT` and pass `handleRenameSection` through `columnOpts`.
Update the header tooltip, which currently claims the cell is read-only.

## Critical Implementation Details

- **Commit path, not setRowData.** The cell calls `opts.onRenameSection` directly. It must never call
  `setRowData` for the name — a per-row write desyncs the denormalized field. `handleRenameSection`
  already patches `rows` + `prevById`, so the displayed value updates optimistically with no diff.
- **Delete-key safety.** With empty names allowed, a stray grid Delete keypress on a selected Sekcja
  cell must not silently blank the whole section. The column's `deleteValue` returns `rowData`
  unchanged (no rename); only an explicit in-cell clear-and-commit renames to empty.

## Phase 1: Editable Sekcja cell

### Overview

Expose the rename handler to the columns builder and replace the read-only Sekcja cell with an
editable, self-committing one.

### Changes Required:

#### 1. Columns builder: option + editable cell + tooltip

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Add `onRenameSection` to the build options; replace the disabled `sectionName` column with
a `SectionNameCell`-backed column that commits section renames on blur/Enter and reverts on Escape;
correct the header tooltip that currently says the cell is read-only.

**Contract**:

- `BuildV2ColumnsOptsT` gains `onRenameSection?: (sectionId: number, name: string) => void`.
- New `SectionNameCell({ rowData }: CellProps<KosztorysV2RowT, unknown>)` — receives `opts` (or
  `onRenameSection`) via the column closure, like `RowActionsCell` receives `opts`. Local draft state
  seeded from `rowData.sectionName`; `onBlur` and Enter → `opts.onRenameSection?.(rowData.sectionId,
draft)`; Escape → reset draft to `rowData.sectionName` and blur. Input styled to match `UnitCell`
  (`size-full bg-transparent px-2 text-left text-sm outline-none`).
- The `sectionName` entry in `identity` becomes a plain column object (not `keyCol`): `{ id:
'sectionName', title: title('sectionName', ...), minWidth: 140, keepFocus: true, component: <the
cell>, copyValue: ({ rowData }) => rowData.sectionName ?? '', deleteValue: ({ rowData }) => rowData }`.
  It is no longer `disabled`.
- `HEADER_TIPS.sectionName` updated: drop "Tylko do odczytu (zmieniana z panelu sekcji)"; state that
  editing here renames the whole section (value is denormalized on every row).

#### 2. Wire the handler into columnOpts

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Pass the existing `handleRenameSection` into the grid's column options so the cell can call
it.

**Contract**: Add `onRenameSection: handleRenameSection` to the `columnOpts` object (around line 157).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit` (or the project's typecheck script)
- Linting passes: `pnpm lint`
- Existing kosztorys unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-money-axis.test.ts src/__tests__/kosztorys-layer.test.ts`

#### Manual Verification:

- Editing a Sekcja cell and blurring renames every row of that section in the grid.
- Pressing Enter commits; pressing Escape reverts to the prior name without persisting.
- The section panel shows the new name after a grid rename.
- The new name survives a page reload (persisted).
- Selecting a Sekcja cell and pressing Delete does NOT blank the section.
- Column hide/show and resize still work on the Sekcja column.

**Implementation Note**: After automated verification passes, pause for human manual confirmation
before archiving.

---

## Testing Strategy

### Unit Tests:

- None required by this change — the fan-out/persist logic (`handleRenameSection`) is pre-existing and
  unchanged.

### E2E (deferred):

- File an `e2e-backlog` Linear issue in project "Wykonczymy": a Playwright spec that edits a Sekcja
  cell, asserts all rows in the section update, and asserts persistence across reload. Record the issue
  id at the review gate.

### Manual Testing Steps:

1. Open a kosztorys with ≥2 sections and multiple items per section.
2. Click a Sekcja cell, type a new name, blur → all rows in that section update.
3. Reload → new name persists.
4. Edit again, press Escape mid-edit → reverts, no persistence.
5. Open the section panel → name matches.
6. Select a Sekcja cell, press Delete → section name unchanged.

## References

- Change identity: `context/changes/kosztorys-section-inline-rename/change.md`
- Rename handler: `src/components/kosztorys/use-kosztorys-editor.ts:499`
- Read-only cell being replaced: `src/lib/tables/kosztorys-v2-columns.tsx:587`
- Custom-cell pattern to follow: `UnitCell` `src/lib/tables/kosztorys-v2-columns.tsx:320`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Editable Sekcja cell

#### Automated

- [x] 1.1 Type checking passes — abc1a1d
- [x] 1.2 Linting passes — abc1a1d
- [x] 1.3 Existing kosztorys unit tests pass — abc1a1d
