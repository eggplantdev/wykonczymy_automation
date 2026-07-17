# Kosztorys Undo / Redo (S-07) — Re-integration Plan

## Overview

Add **in-session undo/redo** to the kosztorys v2 editor: a purely client-side command stack that
reverses recent edits — cell edits, stage-progress edits, ▲▼ reorder, and out-of-grid panel edits
(section rename, per-investment VAT, subcontractor coefficients) — via **toolbar buttons** and
**Cmd+Z / Cmd+Shift+Z**. The stack lives in the browser tab and is discarded on reload; durable
recovery remains S-06 snapshots' job. No schema, no new server actions, no identity map.

The design is already settled and implemented on the unmerged `feat/kosztorys-undo` branch. This plan
is a **re-integration**: the self-contained engine files port verbatim; the editor integration is
re-implemented against staging's post-EX-515 structure. It is not a `git merge`/`rebase` (the branch
is ~200 commits stale and the integration surface was heavily refactored since).

## Current State Analysis

Everything the stack needs already exists on staging; the work is (a) dropping in the finished engine
files and (b) re-capturing inverse operations at the seams staging's editor already funnels writes
through. **Seams verified present on staging 2026-07-17** — handler names intact, line numbers below
are indicative and must be re-confirmed against the current file.

- **All writes originate in `src/components/kosztorys/use-kosztorys-editor.ts`** and pass through two
  shapes: (1) grid cell + stage-progress edits via the grid's `onChange` → `diffRow`
  (`src/lib/kosztorys/v2-rows.ts`) → debounced `save(key, action, revertOne)`; (2) explicit handlers
  for structural + panel ops (`handleReorderItem`, `handleRenameSection` / `handleVatChange` /
  `handleGlobalCoeffChange` / `handleSectionCoeffChange` via `patchRows`).
- **The inverse server actions already exist and are cleanly invertible** (`src/lib/actions/kosztorys.ts`):
  `updateItemFieldAction` (re-send old value), `swapItemOrderAction` (self-inverse),
  `setStageProgressAction` (absolute-value upsert), `updateSectionFieldAction`,
  `updateInvestmentVatAction`, `updateInvestmentCoeffsAction`. No new server code.
- **`prevById` is the single committed baseline** used by `diffRow` to decide what to persist. Any
  undo must update `prevById` in lockstep or the next `onChange` diff re-fires the write.
- **The debounced saver (`use-debounced-save.ts`) exposes no cancel today** — on staging it returns a
  bare `useCallback` (NOT `{ save, cancel }`). Undo needs to pre-empt a pending forward write, so this
  hook gains a cancel path.
- **No client `uid`, no command stack, no keyboard undo exist on staging.** Rows are keyed by DB id
  (stable for the session under Scope A). The toolbar, periodic snapshot, and restore-remount live in
  the shell `src/components/kosztorys/kosztorys-editor-v2.tsx`; toolbar controls render through
  `kosztorys-editor-toolbar.tsx` reading `useKosztorysEditorContext()`.
- **Cascade deletes are already snapshot-backed** (EX-477 confirm-then-snapshot). The roadmap's
  "cascades → snapshots, not undo" split is wired.

### Salvaged assets (port verbatim from `feat/kosztorys-undo`)

These are **new files** with zero conflict against staging — copy as-is, then let typecheck/tests
confirm:

- `src/components/kosztorys/use-undo-redo.ts` — pure `createUndoRedoStack` core + `useUndoRedo` hook +
  `UndoRedoContext`/`useUndoRedoContext`. LIFO, redo-cleared-on-push, `MAX_DEPTH` = 50 eviction,
  `revision` counter.
- `src/lib/kosztorys/undo-coalesce.ts` — `coalesceFieldChanges` / `coalesceStageChanges` pure
  reducers + `FieldChangeT` / `StageChangeT` types.
- `src/components/kosztorys/use-undo-keyboard.ts` — window keydown → undo/redo with the active-edit
  focus guard (the layered-handoff rule).
- Tests: `use-undo-redo.test.ts`, `kosztorys-undo-coalesce.test.ts`, `inverse-coeff-patch.test.ts`
  (place under `src/__tests__/…` per staging's test layout).
- The two `v2-rows` helpers the branch added — `inverseGlobalCoeffPatch`, `inverseSectionCoeffPatch`
  — port into staging's split `v2-rows.ts` (EX-515 may have relocated the module; place beside the
  existing coeff-patch code).

## Desired End State

The editor supports undo/redo of the covered operations. A user presses **Cmd+Z** (or the toolbar
**⟲**) and the last edit is reversed — value written back to the DB, grid re-rendered, totals
recomputed — and **Cmd+Shift+Z** / **⟳** re-applies it. A fresh edit clears the redo stack. Toolbar
buttons disable when their stack is empty. A per-keystroke burst collapses into one undo entry. An
idle editor no longer writes duplicate auto-snapshots.

Verify: typecheck + lint clean; the ported unit suites pass; the manual checklist (§ S-07) passes
against the 5435/5433 DB with psql confirmation.

### Key Discoveries

- Inverse actions already exist and are idempotent/self-inverse — undo is "issue the inverse server
  write," not a local rewind.
- `prevById` must be updated by every undo/redo, exactly as the rollback path does.
- Programmatic `setRows` from an undo does **not** re-enter `onChange` (dsg fires `onChange` only on
  user grid edits) — no double-capture.
- Panel VAT/coeff values are **denormalized onto every row** (`treeToRows`), so their undo re-patches
  all (or all in-section) rows + `prevById` via `patchRows` — same cost as the original panel edit.
- dsg text cells run `continuousUpdates:true` → one `onChange` per keystroke. Naive capture makes
  undo per-character and overflows the 50-deep stack; **burst coalescing** (`UNDO_COALESCE_MS` =
  700ms, longer than the 500ms debounce) collapses a burst into one command and drops net-zero
  type-then-revert bursts.

## What We're NOT Doing

- **No add/delete undo** (item, section, or stage). Recovery of deletions stays with S-06 snapshots.
- **No `uid` identity map / id-rewriting.** Documented as a future seam in `change.md`.
- **No cascade (section/stage) delete undo** — snapshot-backed already.
- **No new server actions and no schema/migration.** Purely client-side + reuse of existing actions.
- **No persistence of the stack across reload** — in-session only, by design.
- **No `git merge`/`rebase` of `feat/kosztorys-undo`** — port + re-integrate instead.
- **Not authoring the browser E2E in this plan** — deferred to an `e2e-backlog` Linear issue (S-07
  lands in-review, not Done, until it's written).

## Implementation Approach

A **Command pattern** over two in-memory stacks (undo / redo). Each command carries the data to both
reverse and re-apply an operation:

```
Command = {
  label: string
  undo: () => Promise<void>   // apply "before": setRows/patchRows + inverse server write + prevById
  redo: () => Promise<void>   // apply "after":  setRows/patchRows + forward server write + prevById
}
```

Commands are **captured at the existing seams** (piggybacking on data already computed there). The
normal edit still persists through the existing path; the command only _records_ how to reverse it.
`undo()`/`redo()` fire only when the user later invokes them — at which point they cancel any pending
debounced save for the affected key, issue the inverse/forward write **immediately** (not debounced),
update `prevById` in lockstep, and reuse the editor's `router.refresh()` to pull recomputed totals.

The stack is exposed via `{ push, undo, redo, canUndo, canRedo, revision, reset }`, instantiated once
per editor mount in the shell and shared through `UndoRedoContext` — reachable by both
`use-kosztorys-editor.ts` (captures + push) and the shell/toolbar (buttons + the S-06 interval gate).

## Critical Implementation Details

**Re-integration is the risk, not the design.** `use-kosztorys-editor.ts` drifted +366/−139 on
staging since the branch's base. Before wiring each capture, re-read the current handler
(`onChange`, `handleReorderItem`, the panel handlers) and attach to its _actual_ present shape — the
branch diff's line numbers are stale. The handler _names_ and the `prevById`/`diffRow`/action seams
are confirmed intact, so each capture has a definite home.

**Cmd+Z ↔ dsg native cell undo — layered handoff (chosen).** The global Cmd+Z / Cmd+Shift+Z listener
drives our stack **only when no editable field is actively focused** (`document.activeElement` is not
`input`/`textarea`/`contenteditable`, which also protects the snapshot-label and rename inputs);
while a cell/input is being edited, the key falls through to dsg's native character-level undo. This
is the branch's verified behavior. The boundary — a native undo of a value that already coalesced
into our stack — is the sharp edge; it is exercised in the manual checklist here and pinned by the
deferred E2E.

**Reconciling undo with the debounced saver.** An undo of a field must **cancel the pending debounced
save** for that key before writing the inverse, or the stale forward-save races the inverse.
`use-debounced-save.ts` gains a `cancel(key)` (clear the key's timer) and returns `{ save, cancel }`;
every current call site of the hook updates to the new return shape.

**Never fire a server action inside a `setState` updater** (`lessons.md`) — undo/redo compute next
state in the updater but fire the inverse write and `router.refresh()` from the handler, reading
fresh state from the existing `prevById`/rows refs.

## Phase 1: Port engine + re-integrate grid-edit & reorder commands

### Overview

Drop in the salvaged engine files, add cancel to the debounced saver, wire the shell provider +
toolbar + keyboard, and re-capture the highest-frequency operations against staging's current
`use-kosztorys-editor.ts`: cell field edits, stage-progress edits, and ▲▼ reorder — with burst
coalescing.

### Changes Required

#### 1. Port the engine + coalesce + keyboard files

**File**: `src/components/kosztorys/use-undo-redo.ts`, `src/lib/kosztorys/undo-coalesce.ts`,
`src/components/kosztorys/use-undo-keyboard.ts` (all new) + their tests.

**Intent**: Copy verbatim from `feat/kosztorys-undo`; adjust only import paths / test locations to
staging's layout. These carry no integration logic, so they compile independently.

**Contract**: `useUndoRedo()` → `{ push, undo, redo, canUndo, canRedo, revision, reset }`;
`UndoRedoContext` + `useUndoRedoContext()`; `coalesceFieldChanges`/`coalesceStageChanges`;
`useUndoKeyboard(undo, redo)`. Hooks obey React Compiler naming.

#### 2. Cancelable debounced saver

**File**: `src/components/kosztorys/use-debounced-save.ts`

**Intent**: Let an undo pre-empt a pending save for a key. Add a cancel path that clears that key's
timer from the internal `Map`.

**Contract**: hook returns `{ save, cancel }` (was a bare callback); `cancel(key: string)` clears the
key's timer. Update every call site to the new shape — primarily `use-kosztorys-editor.ts`.

#### 3. Shell: instantiate the stack + toolbar buttons

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx` (+ `kosztorys-editor-toolbar.tsx`)

**Intent**: Create the per-mount `useUndoRedo()` instance in the shell and provide it via
`UndoRedoContext`. Add two toolbar buttons (⟲ Cofnij / ⟳ Ponów) beside the existing controls, disabled
on `!canUndo`/`!canRedo`, wired to `undo`/`redo`, Polish tooltips with the shortcut hint. Given
staging's toolbar reads `useKosztorysEditorContext()`, surface `canUndo`/`canRedo`/`undo`/`redo`
through the editor context (or read `useUndoRedoContext()` directly in the toolbar).

**Contract**: one stack instance per editor mount (never a module singleton); toolbar buttons read
`canUndo`/`canRedo`; icons from the existing set; match toolbar styling.

#### 4. Keyboard listener

**File**: `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: Mount `useUndoKeyboard(undo, redo)` so Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) →
redo, guarded by the active-edit focus heuristic (layered handoff).

**Contract**: listener ignores the event when an editable field is focused (native undo wins);
otherwise routes to the stack API. `preventDefault` only when we handle it.

#### 5. Capture grid-edit commands (with coalescing)

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Re-read staging's current `onChange`. Buffer each keystroke's field/stage changes into
pending refs; after the burst quiets (`UNDO_COALESCE_MS`) flush into one composite command via
`coalesceFieldChanges`/`coalesceStageChanges` and `push` it (drop a net-zero burst). The command's
`undo` writes `before` (cancel matching debounced key → immediate `updateItemFieldAction`/
`setStageProgressAction` + `setRows` + `prevById` update + `router.refresh`), `redo` writes `after`.
Do **not** change the normal edit-persist path. A restore-remount must clear the dangling flush timer.

**Contract**: one coalesced `push` per edit burst; payload = `FieldChangeT[]` + `StageChangeT[]`.
A `flushUndoBuffer()` + `pushCommand()` (flush-then-push) keep LIFO order when a structural command
lands mid-burst.

#### 6. Capture reorder commands

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: In staging's `handleReorderItem`, `pushCommand` a self-inverse command wrapping the
two-row swap. `undo` swaps back (`swapItemOrderAction` with orders exchanged + local swap), `redo`
re-swaps. No `prevById` touch (display_order isn't a diffed field), no totals refresh.

**Contract**: command carries `{ first:{id,order}, second:{id,order} }`.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Ported unit suites pass: `pnpm exec vitest run src/__tests__/components/kosztorys/use-undo-redo.test.ts src/__tests__/kosztorys-undo-coalesce.test.ts`

#### Manual Verification:

- Edit a cell → Cmd+Z reverts the value in the grid **and** the DB (psql read on 5435/5433);
  Cmd+Shift+Z re-applies it.
- Edit a stage-progress cell → undo/redo reverses/re-applies it and section totals recompute.
- ▲▼ reorder a row → undo restores the original order (`display_order` back to original).
- Toolbar ⟲/⟳ perform the same and disable correctly at stack ends.
- Type a multi-character value, then **one** Cmd+Z → the whole word reverts (not one char) — burst
  coalescing at the browser level.
- **Cmd+Z coexistence (layered handoff):** while actively typing in a cell, Cmd+Z does native
  character undo; after committing/blurring, Cmd+Z does a stack undo. **Record any misroute** — this
  is the flagged boundary.

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation
(especially the flagged Cmd+Z coexistence) before Phase 2.

---

## Phase 2: Panel-edit commands (rename / VAT / coefficients)

### Overview

Extend the stack to the out-of-grid edits made through side panels, which mutate denormalized fields
across every row via `patchRows`.

### Changes Required

#### 1. Capture panel-edit commands

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: In staging's `handleRenameSection`, `handleVatChange`, `handleGlobalCoeffChange`,
`handleSectionCoeffChange`, `pushCommand` a command capturing `{ target, before, after }`.
`undo`/`redo` re-issue the existing action (`updateSectionFieldAction` / `updateInvestmentVatAction` /
`updateInvestmentCoeffsAction`) with the before/after value and re-run `patchRows` over the affected
rows + `prevById`, matching the handler's own optimistic patch. Use the ported
`inverseGlobalCoeffPatch`/`inverseSectionCoeffPatch` helpers for the coeff inverse.

**Contract**: rename command scoped to one `sectionId`; VAT/coeff commands patch the denormalized
field on all (or all in-section) rows via `patchRows`. Cancel any pending debounced save for a
section-rename key on undo (rename routes through `save`).

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Ported inverse-coeff unit suite passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/inverse-coeff-patch.test.ts`

#### Manual Verification:

- Rename a section → undo restores the old name in the grid header and DB.
- Change per-investment VAT → undo restores the old rate; every row's Brutto recomputes back.
- Change a global and a section coefficient → undo restores each; derived subcontractor prices
  recompute back under the active price view.
- Interleave a panel edit with grid edits and undo across the boundary in LIFO order.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: S-06 idle-snapshot dirty-flag gate

### Overview

Gate S-06's unconditional 10-min auto-snapshot interval on the stack's dirty signal so an untouched
editor stops writing identical snapshots (roadmap parks this follow-up here).

### Changes Required

#### 1. Gate the periodic snapshot on `revision`

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Intent**: The periodic-snapshot interval remembers the stack `revision` at the last snapshot; each
tick skips capture when `revision` is unchanged (nothing edited/undone/redone since). Restore and
reset zero the marker appropriately. Confirm staging's current periodic-snapshot implementation
before wiring (S-06 shipped it as an unconditional interval).

**Contract**: interval reads `revision` from the stack API; captures only when
`revision !== lastSnapshotRevision`, then stores the new value. Forced pre-destruction snapshots stay
unconditional.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Full kosztorys unit suite passes: `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/components/kosztorys`

#### Manual Verification:

- Open the editor and leave it idle past one interval tick → no new `auto` snapshot row appears
  (Wersje drawer / DB).
- Make one edit, wait a tick → exactly one new `auto` snapshot appears; idle again → no further ones.
- A forced pre-delete snapshot (delete an empty section/stage) still fires regardless of the gate.

**Implementation Note**: Final phase — aggregate the manual-verification bullets into
`context/foundation/manual-checks.md` (§ S-07), and file the deferred browser E2E as an `e2e-backlog`
Linear issue in project "Wykonczymy" before closing the review gate.

---

## Testing Strategy

### Unit Tests (Vitest — the primary automated guard)

- Stack ordering: push/undo/redo LIFO, redo-cleared-on-push, depth-cap eviction, `revision` bump
  (ported `use-undo-redo.test.ts`).
- Burst coalescing: a keystroke sequence collapses to one change; net-zero burst drops
  (ported `kosztorys-undo-coalesce.test.ts`).
- Inverse coeff patch: global/section coeff inverse targets the right rows
  (ported `inverse-coeff-patch.test.ts`).

### Integration / E2E

- **Deferred** to an `e2e-backlog` Linear issue. Minimum coverage when authored (assert persisted
  state, not return values): Cmd+Z / toolbar undo reverses a persisted cell edit; redo re-applies;
  toolbar disabled-states track the stack; a multi-char value undone once reverts the whole word
  (coalescing regression guard); and the layered Cmd+Z boundary (native char-undo while editing vs
  stack undo when blurred).

### Manual Testing Steps

Per each phase's Manual Verification bullets, driven as OWNER against the 5435/5433 DB with psql
confirmation of persisted state.

## Performance Considerations

Stack is capped at `MAX_DEPTH` = 50 (oldest evicted). Coalescing prevents per-keystroke stack growth.
Undo/redo issue immediate writes (not debounced) but only on explicit user action — no hot-path cost.

## Migration Notes

None. No schema, no migration, no data.

## References

- Salvaged implementation: `feat/kosztorys-undo` @ `8e4eb7c` (engine + tests port verbatim).
- Roadmap slice: `context/foundation/roadmap.md` § S-07.
- Linear: EX-403.
- Snapshot slice this gates: S-06 (`context/archive/…` / EX-418).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Port engine + re-integrate grid-edit & reorder commands

#### Automated

- [x] 1.1 Type checking passes: `pnpm exec tsc --noEmit` — 88504da
- [x] 1.2 Linting passes: `pnpm lint` — 88504da
- [x] 1.3 Ported unit suites pass (use-undo-redo + undo-coalesce) — 88504da

### Phase 2: Panel-edit commands (rename / VAT / coefficients)

#### Automated

- [x] 2.1 Type checking passes: `pnpm exec tsc --noEmit`
- [x] 2.2 Linting passes: `pnpm lint`
- [x] 2.3 Ported inverse-coeff unit suite passes

### Phase 3: S-06 idle-snapshot dirty-flag gate

#### Automated

- [ ] 3.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 3.2 Linting passes: `pnpm lint`
- [ ] 3.3 Full kosztorys unit suite passes
