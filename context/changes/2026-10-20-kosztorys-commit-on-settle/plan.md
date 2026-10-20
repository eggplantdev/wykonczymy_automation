# Kosztorys numeric cells commit on settle — Implementation Plan

## Overview

Every numeric kosztorys cell (Przedmiar, etapy, Aktualizacja przedmiaru, rabat, cena/mnożnik
podwykonawcy) wrote the row on each parsable keystroke, so each key ran the whole editor pipeline
over ~1000 rows. The cell now holds a local draft and writes once — on Enter, Tab, blur or unmount.
The spike (`dc612530e`) proved the win: median keystroke 49 → 31 ms (the two-frame metric floor),
p90 roughly halved, interleaved A/B staging vs preview. Owner vibe check passed. This plan hardens the
spike: strip the machinery that only existed to undo per-keystroke writes, and re-pin the behaviour in
specs.

Decisions are settled upstream (Linear EX-1116 description + owner ruling 2026-10-20) — no
questioning round:

- live totals while typing are not wanted; the toolbar search stays live (separate input, untouched)
- accepted: row figures/totals update after Enter; closing the tab mid-typing loses the draft; with a
  search active, the edited row doesn't drop out mid-typing
- the per-keystroke work-budget guard spec from the original EX-1116 is dropped

## Current State Analysis

- `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts` — the shared edit machine for all
  five numeric cells (`decimal-column.tsx`, `current-planned-qty-cell.tsx`, `discount-columns.tsx`,
  `subcontractor/price-cell.tsx`, `subcontractor/coeff-cell.tsx`). The spike removed the per-keystroke
  `setRowData` in `change()` and added the write inside `settle()`'s `keep` branch. The refuse verdict
  (`blockReason`) is still computed live per keystroke — pure, cheap, and must stay.
- `src/lib/kosztorys/cell-edit.ts` — `cellSettle` still models the per-keystroke world: `keep` means
  "the row already holds the value", `rollback` restores the entry snapshot because a prefix was
  written. `CellEditPolicyT` carries `snapshot` / `sameEntry` / `restore` solely for that rollback
  and for the Esc restore in `useCellDraft.cancel`.
- With commit-on-settle the row never holds a draft value, so:
  - a refused/unreadable draft at settle needs **no write** — the row already holds what it held
    before the edit; only the announcement remains (blocked → error toast naming the current value;
    invalid → silent, as today when nothing was displaced)
  - Esc needs **no write** — drop the draft
  - the entry snapshot, `sameEntry` and `restore` become dead across the five policies
    (`numericFieldPolicy`, `currentPlannedQtyPolicy`, `discountPolicy`, both subcontractor policies)
  - the `rowId` guard (row swapped under the caret by virtualization) still matters — keep it
- `src/lib/kosztorys/undo-coalesce.ts` `foldRetractions` (+ `amendTop`) is **not** dead: the long-text
  cell (`ui/datasheet-grid/long-text-cell.tsx`) still commits per keystroke and on Escape writes
  `valueBeforeEdit` back — a there-and-back the fold cancels. It stays; only its lesson's wording
  (`context/foundation/lessons.md` → „Undo coalescing must cancel a rollback…") names the numeric
  prefix case that no longer exists.

## Desired End State

- Typing in any numeric kosztorys cell writes nothing to the row until Enter / Tab / blur / unmount.
- Enter/Tab/blur with a readable value: one write, one warning toast if the policy warns.
- Settle with a refused value: no write, one error toast „…przywrócono <current value>".
- Settle with unreadable text (`12x`, `-`): no write, no toast.
- Emptied cell: one write clearing it (0 / back to „auto" / follows ofertowy — per policy, as today).
- Esc: no write, no toast, selection stays.
- Undo after one edit reverts the whole number in one step.
- `CellEditPolicyT` has no `snapshot` / `sameEntry` / `restore`; no caller references them.

### Key Discoveries:

- `use-cell-draft.ts:46-72` — `settle()` branches on `keep` / `clear` / `rollback`; after this change
  it branches on commit / clear / reject.
- `cell-edit.ts:47-49` — the comment on `cellKeystroke` ("Keystrokes commit as they go…") is false now.
- `use-cell-draft.ts:82-83` — the Esc comment ("the rollback has to be the last write") is false now.
- `decimal-cell.test.tsx:74-90` — pins the prefix rollback ("restores the quantity … committed
  prefix is rejected"); its premise is gone.
- `subcontractor-price-edit.test.tsx:79` „ogłasza przekroczenie raz, na wyjściu…" and `:173`
  „nie przemontowuje inputa, gdy werdykt pojawia się pod palcami" — still valid, must stay green.

## What We're NOT Doing

- Long-text cells (description etc.) — they still commit per keystroke. Not measured; a separate
  decision with its own A/B if wanted.
- The undo retraction fold — still load-bearing for long-text Escape.
- `src/components/ui/decimal-field.tsx` (form field outside the grid) — different component.
- Measuring the cost at Enter — one write per number replaces N writes; no regression path.
- The per-keystroke work-budget guard spec (dropped by the owner).
- Memoizing `columnOpts` / `buildV2Grid` in `use-kosztorys-editor.ts`.

## Implementation Approach

Change the settle contract in the React-free layer first (`cell-edit.ts` + its specs), then shrink
the policies, then rewrite `useCellDraft` against the new contract, then re-pin the DOM behaviour.
One code phase — the type change makes the layers move together. A second phase commits the A/B
harness and fixes the docs that describe the old model.

## Phase 1: Settle-only commit

### Overview

Replace the rollback model with a "draft never touches the row" model across lib, policies, hook and
specs.

### Changes Required:

#### 1. Settle contract

**File**: `src/lib/kosztorys/cell-edit.ts`

**Intent**: `cellSettle` decides what ONE write at the end of an edit is, given the untouched row.
No entry snapshot, no "already settled" check.

**Contract**: `cellSettle(draft, rowData, policy)` (no `entry` arg) returns
`{ kind: 'commit'; row; warning: string | null } | { kind: 'clear'; row } | { kind: 'reject'; reason: 'blocked' | 'invalid' }`.
`cellKeystroke` keeps its signature (the live refuse verdict reads it); its obsolete comment goes.
`CellEditPolicyT` drops `snapshot`, `sameEntry`, `restore`; the generic `EntryT` goes with them if
nothing else needs it. `numericFieldPolicy` shrinks accordingly.

#### 2. Policies

**Files**: `src/lib/kosztorys/current-planned-qty-edit.ts`, `src/lib/kosztorys/discount-edit.ts`,
`src/lib/kosztorys/subcontractor-price-edit.ts`

**Intent**: delete the three dead members from each policy; delete helpers that only fed them
(gate on typecheck, not grep).

**Contract**: each policy returns the slimmed `CellEditPolicyT`; `restoredLabel(row)` now reads the
current row (which IS the pre-edit value).

#### 3. Hook

**File**: `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts`

**Intent**: the draft is local until settle. `settle()` writes on commit/clear, toasts on
`reject: 'blocked'` with `restoredLabel(rowData)`, stays silent on `reject: 'invalid'`. `cancel()`
only closes the draft. The `rowId` guard and the single-settle `liveEdit` ref stay.

**Contract**: return shape unchanged (`draft`, `blockReason`, `inputProps`) — the five cells don't
change. `CellEditT` loses `entry`. Stale comments (Esc "rollback has to be the last write", the JSDoc
about the row re-rendering over the separator) are rewritten to one sentence or removed.

#### 4. Specs

**Files**: `src/__tests__/lib/kosztorys/cell-edit.test.ts`,
`src/__tests__/lib/kosztorys/current-planned-qty-edit.test.ts`,
`src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts`,
`src/__tests__/components/kosztorys/editor/grid/cells/decimal-cell.test.tsx`

**Intent**: re-pin behaviour on the new contract, asserting persisted row state (the host's stored
value), not return values.

**Contract** (DOM, `decimal-cell.test.tsx`):

- typing `123` writes nothing until Tab (spy on `setRowData`: 0 calls while typing, 1 after Tab)
- `12,5` + Tab stores 12,5 (kept)
- `12x` + Tab: stored value unchanged, no toast; a refused value + Tab: stored unchanged, one error
  toast „przywrócono …"
- `99{Escape}`: no write, no toast
- emptied + Tab stores 0 (kept)
- unmount mid-edit with a readable draft commits it once; with a refused draft, one toast, no write
  Lib specs: drop `entry` args and the `rollback`/`row: null` cases; add `reject` cases.

### Success Criteria:

#### Automated Verification:

- Lib specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/cell-edit.test.ts src/__tests__/lib/kosztorys/current-planned-qty-edit.test.ts src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts`
- Cell DOM specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/cells/`

#### Manual Verification:

- Edytor kosztorysu (~1000 pozycji) → wpisz liczbę w „Przedmiar ofertowy": znaki pojawiają się bez
  przycięć; „Wartość netto" wiersza i sumy w stopce zmieniają się dopiero po Enterze.
- „Etap 1" → wpisz ilość, Enter: „Pomiar z natury" i suma etapów aktualizują się raz; Cofnij (Ctrl+Z)
  przywraca poprzednią ilość jednym krokiem.
- „Rabat" → wpisz 150% (odmowa): czerwony komunikat widoczny już przy pisaniu; po Enterze komunikat
  „…przywrócono" i rabat bez zmian.
- Dowolna komórka liczbowa → wpisz liczbę, Esc: wartość bez zmian, bez komunikatu, zaznaczenie zostaje.
- „Aktualizacja przedmiaru" → wyczyść komórkę, Enter: wartość wraca do szarej (podąża za ofertowym).
- Stawka podwykonawcy → mnożnik ponad sufitem, Enter: jedno ostrzeżenie, wartość zostaje.
- Z aktywnym wyszukiwaniem: edytowany wiersz nie znika w trakcie pisania.

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 2: Harness and docs

### Overview

Keep the A/B harness for the next perf change and correct the docs that describe the old model.

### Changes Required:

#### 1. Harness

**File**: `scripts/perf/keystroke-ab.js` (exists, uncommitted)

**Intent**: commit as-is; its URLs are the two deployments of this A/B and get edited per run.

#### 2. Perf doc

**File**: `context/reference/perf-measurement.md` → `## Tools`

**Intent**: one bullet naming the keystroke A/B harness: what it measures (keypress → double rAF),
how it runs (Playwright MCP `browser_run_code`, interleaved staging/preview), its preconditions
(perf kosztorys on inwestycja 7, viewport ≥ 1700 px, totals panel closed), and that ~31 ms is the
metric floor.

#### 3. Lesson

**File**: `context/foundation/lessons.md` → „Undo coalescing must cancel a rollback across the window
boundary"

**Intent**: the rule stands, the example changes — the there-and-back now comes from long-text Escape
writing the pre-edit text back after per-keystroke commits; numeric cells no longer write a prefix.

### Success Criteria:

#### Automated Verification:

- None — prose and a dev-only script.

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- `cellSettle` commit / clear / reject(blocked) / reject(invalid), across numeric, discount,
  current-planned and both subcontractor policies.

### Integration Tests:

- DOM: zero writes while typing, one write on settle, none on Esc / unreadable / refused.

## Performance Considerations

The win is already measured on the spike (49.5 → 31 ms median, p90 86 → 48 ms on Przedmiar). Phase 1
changes no hot path beyond the spike; no re-measurement needed unless Phase 1 adds work per keystroke.

## Whole-tree Gate

Run once, after Phase 2:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Kosztorys specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/components/kosztorys`

## References

- Linear EX-1116 (A/B results comment)
- Spike: `dc612530e`
- Harness: `scripts/perf/keystroke-ab.js`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Settle-only commit

#### Automated

- [ ] 1.1 Lib specs pass
- [ ] 1.2 Cell DOM specs pass

### Phase 2: Harness and docs

#### Automated

- [x] 2.1 None — prose and a dev-only script
