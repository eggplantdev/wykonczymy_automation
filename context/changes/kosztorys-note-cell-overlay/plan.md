# Long-text cell overlay for the kosztorys grid — Implementation Plan

## Overview

Long free text in the grid is unreadable: `textColumn` renders a single-line `<input>` inside a 32px
row, so „opis pracy" and „komentarz" clip with no way to see the rest. Replace the three text cells
with one component that stays a truncated one-liner when inactive and, on focus, opens a `<textarea>`
positioned over the cell — the Google Sheets behaviour.

## Current State Analysis

The grid is `DynamicDataSheetGrid` with a fixed `rowHeight={32}` (`src/components/kosztorys/kosztorys-editor-body.tsx:171`).
Row height is uniform and not content-measured, so wrapping is impossible without an overlay.

Three columns hold free text (`src/components/kosztorys/kosztorys-v2-columns.tsx`):

| Column                     | Current def                                   | Commit path                        |
| -------------------------- | --------------------------------------------- | ---------------------------------- |
| `description` (opis pracy) | `keyCol('description', textColumn, …)` `:248` | `setRowData` → row patch           |
| `note` (Komentarz)         | `keyCol('note', textColumn, …)` `:378`        | `setRowData` → row patch           |
| `sectionName` (Sekcja)     | custom `SectionNameCell` `:240`               | `onRename` → whole-section fan-out |

Both `description` and `note` are already members of `ItemPatchT` (`src/lib/kosztorys/types.ts:52,65`),
so persistence needs no change — `setRowData` flows through the existing diff/autosave pipeline.

`SectionNameCell` (`src/components/kosztorys/cells/section-name-cell.tsx`) already implements the
draft-while-editing / commit-on-blur / revert-on-Escape pattern this plan generalizes. Its column def
carries a deliberate `deleteValue` no-op so a stray Delete can't blank a whole section (`:244-246`).

### Key Discoveries

- DSG passes `focus`, `active`, `setRowData`, `stopEditing` to a custom cell (`react-datasheet-grid/dist/types.d.ts:9-26`).
- Columns support `disableKeys` (stop DSG eating Enter/arrows) and `keepFocus` (keep the cell active
  while real focus lives in an overlay) — the library's sanctioned hooks for exactly this.
- `.dsg-cell` sets no `overflow: hidden`, so an absolutely-positioned overlay is not clipped by its
  own cell. `.dsg-container` is `overflow: auto`, so the overlay is bounded by the grid viewport.
- `floatColumnLeft` (`kosztorys-v2-columns.tsx:60`) establishes the spread-and-override idiom for
  customizing a stock column. Spreading `textColumn` inherits `copyValue` / `pasteValue` /
  `deleteValue` / `isCellEmpty`, so copy-paste on these columns keeps working for free.

## Desired End State

Clicking any of the three text cells opens a textarea large enough to read and edit the whole value.
Leaving the cell commits through that column's existing path. The grid's resting appearance, row
height, and copy-paste behaviour are unchanged. `section-name-cell.tsx` no longer exists — its
behaviour is expressed as wiring on the generic cell.

## What We're NOT Doing

- **No hover-to-read on inactive cells.** Deferred by the owner pending an eyeball test of the
  overlay alone; revisit only if scanning still hurts.
- No per-row height expansion (`rowHeight` as a function) — rejected during shaping; it breaks the
  uniform-row look and grows every column in the row for nothing.
- No Radix Popover / portal — rejected during shaping; its focus trap fights DSG's keyboard model.
- No change to the autosave, diff, or persistence layer.
- No new E2E fixture (see Testing Strategy).

## Implementation Approach

One presentational cell, dumb about domain: it receives `value` and `onCommit(next)` and knows
nothing about rows, sections, or patches. Each column supplies its own `onCommit` — `setRowData` for
the item columns, `onRename` for the section column. Branching lives in the two wiring sites, not
inside the component.

Phase 1 is purely additive (new component, two columns adopt it). Phase 2 replaces code that already
works, so it is separable and independently revertable.

## Critical Implementation Details

**Stacking.** `.dsg-row` elements are absolutely positioned siblings, so a later row paints over an
earlier one. The overlay needs an explicit elevated `z-index` or notes on upper rows will render
behind the rows beneath them.

**Key handling.** The column must set `disableKeys: true` or DSG intercepts Enter and the arrow keys
before the textarea sees them. `keepFocus: true` keeps the cell registered as active while focus sits
in the overlay.

---

## Phase 1: Generic long-text cell, adopted by `description` and `note`

### Overview

Add the component and wire the two item text columns to it. Nothing existing is removed.

### Changes Required

#### 1. The cell component

**File**: `src/components/kosztorys/cells/long-text-cell.tsx` (new)

**Intent**: Render a truncated single line at rest and an overlay textarea when the cell has focus, so
long values are readable and editable without changing row height. Follows the draft/commit/revert
pattern already proven in `section-name-cell.tsx`.

**Contract**: `{ value: string; focus: boolean; onCommit: (next: string) => void; stopEditing: () => void }`.
Local draft seeded from `value` on focus (never a mount-time snapshot, so an external edit isn't held
stale). Commit on blur; `Escape` reverts and stops editing; `Enter` commits and stops editing;
`Shift+Enter` inserts a newline. The overlay is absolutely positioned at the cell's top-left,
elevated `z-index`, and sized so a realistic opis is fully visible without scrolling — a real one
runs ~130 characters ("szpachlowanie połaczeń ścian z gk i wklejanie taśmy wzmacniającej (
(łączenia pęknięć płyt, łączenia płyt gk etc.)"), so ~420px wide × ~7rem tall is the floor, not a
target. Never narrower than the cell it covers.

#### 2. Column wiring

**File**: `src/components/kosztorys/kosztorys-v2-columns.tsx`

**Intent**: Point the `description` (`:248`) and `note` (`:378`) columns at the new cell while keeping
everything `textColumn` gave them.

**Contract**: Spread-and-override in the `floatColumnLeft` idiom — a shared cell-level column derived
from `textColumn` with `component`, `disableKeys: true`, `keepFocus: true`, passed through the
existing `keyCol` helper so the key mapping and copy/paste/delete inheritance are unchanged. Each
column's existing `id`, `title`, `minWidth`, `grow`, and className props stay as they are — including
the `note` column's `border-l` block-divider classes.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing test suite passes: `pnpm exec vitest run`

#### Manual Verification:

- Clicking an „opis pracy" cell with long text opens an overlay showing the full value
- Enter commits and moves to the next row; Shift+Enter inserts a newline; Escape reverts
- The overlay renders above the rows beneath it, not behind them
- Copy/paste of a text cell still works (Cmd+C on the cell, Cmd+V into another)
- Resting row height and grid appearance are unchanged

**Implementation Note**: Pause after this phase for manual confirmation before starting Phase 2.

---

## Phase 2: Migrate `sectionName` onto the generic cell

### Overview

Replace `SectionNameCell` with the generic cell wired to the rename fan-out, then delete the old file.

### Changes Required

#### 1. Section column wiring

**File**: `src/components/kosztorys/kosztorys-v2-columns.tsx`

**Intent**: Express the Sekcja cell as the generic cell plus an `onCommit` that calls
`opts.onRenameSection`, preserving the two behaviours the current cell guarantees: the rename fans out
to the whole section (never a per-row `setRowData`, which would rewrite only this row's denormalized
copy), and a stray Delete on the cell is a no-op.

**Contract**: The column keeps its existing `copyValue` and its `deleteValue: ({ rowData }) => rowData`
no-op guard verbatim; only `component` changes. `onCommit` receives the draft and calls
`onRenameSection(rowData.sectionId, next)`.

#### 2. Remove the superseded cell

**File**: `src/components/kosztorys/cells/section-name-cell.tsx` (delete)

**Intent**: Its behaviour now lives in the generic cell; keeping it would leave two implementations of
the same editing pattern.

**Contract**: Deletion is gated on `pnpm typecheck` reporting no remaining references — not on grep.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing test suite passes: `pnpm exec vitest run`
- `src/components/kosztorys/cells/section-name-cell.tsx` no longer exists

#### Manual Verification:

- Renaming a section from the grid cell updates every row of that section, not just the edited row
- A rename made in the section panel is reflected in the grid cell without a reload
- Pressing Delete on a selected Sekcja cell does not blank the section name
- Escape during a section rename reverts without committing

---

## Testing Strategy

### Unit Tests

None. The change is overlay positioning, focus, and key handling — there is no pure function here
whose test would carry honest signal, and asserting on the component's internal draft state would be
testing the implementation rather than observable behaviour.

### Browser E2E

This is browser-level behaviour, so per `AGENTS.md` the slice owes an E2E. `e2e/` currently has no
kosztorys editor spec at all, so authoring one means building the editor fixture from scratch —
disproportionate to this change. **Discharge by filing a Linear issue in project "Wykonczymy" labelled
`e2e-backlog`**, covering: overlay opens on focus, Enter/Shift+Enter/Escape semantics, and section
rename fan-out. The manual checks above cover it in the interim.

### Manual Testing Steps

1. Seed a kosztorys with long text: `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`
2. Open the editor, click an „opis pracy" cell holding a realistic value — use „szpachlowanie
   połaczeń ścian z gk i wklejanie taśmy wzmacniającej ( (łączenia pęknięć płyt, łączenia płyt gk
   etc.)" — and confirm the overlay shows the whole string without an inner scrollbar
3. Type a multi-line note with Shift+Enter, commit with Enter, reopen — confirm newlines survived
4. Scroll so the edited row is near the bottom edge, open the overlay — confirm it isn't clipped
5. Rename a section from the grid cell — confirm every row of that section updates

## Performance Considerations

None. One extra element renders per focused cell; there is exactly one focused cell at a time.

## Migration Notes

None — no schema, data, or persisted-shape change.

## References

- Shaping notes and rejected alternatives: `context/changes/kosztorys-note-cell-overlay/change.md`
- Pattern being generalized: `src/components/kosztorys/cells/section-name-cell.tsx`
- Column customization idiom: `src/components/kosztorys/kosztorys-v2-columns.tsx:60`
- DSG cell contract: `node_modules/react-datasheet-grid/dist/types.d.ts:9-26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Generic long-text cell, adopted by `description` and `note`

#### Automated

- [ ] 1.1 Type checking passes: `pnpm typecheck`
- [ ] 1.2 Linting passes: `pnpm lint`
- [ ] 1.3 Existing test suite passes: `pnpm exec vitest run`

### Phase 2: Migrate `sectionName` onto the generic cell

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Linting passes: `pnpm lint`
- [ ] 2.3 Existing test suite passes: `pnpm exec vitest run`
- [ ] 2.4 `src/components/kosztorys/cells/section-name-cell.tsx` no longer exists
