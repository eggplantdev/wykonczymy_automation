# Worker PDF — „Tylko pozycje z wykonaną pracą" Implementation Plan

## Overview

„Drukuj kosztorys pracownika (PDF)" opens a small dialog with one checkbox, „Tylko pozycje z
wykonaną pracą", ticked by default. Ticked, the PDF lists only pozycje where the worker's etapy have
qty done > 0, and its table totals follow the printed rows. Nothing is persisted.

## Current State Analysis

- The worker projection keeps every kosztorys item and narrows only `stages`/`progress` to his etapy
  (`src/lib/queries/worker-kosztorys.ts:75-80`).
- `buildWorkerPrintHtml` (`src/lib/kosztorys/print/worker.ts:96-143`) prints `documentRows(rows, …)`
  (`client-empty` only) but totals `totalsOf(rows)` / `groupBySection(rows)` over **all** rows
  (`:117-119,131-136`). Today equal by the two-axis empty invariant (`row-conditions/registry.ts:248`).
- `WorkerPrintMenuItem` (`src/components/kosztorys/editor/actions/worker-print-action.tsx`) prints
  straight from a menu click; two variants (`pdf`, `form`) in a `VARIANTS` map.
- Dialogs that serve every worker live in `useWorkerActions`
  (`editor/actions/use-worker-actions.ts`, e.g. `shareTarget`/`shareOpen`/`requestShare`) and are
  mounted beside the menus in `editor/toolbar/menus/kosztorys-actions-menu.tsx:145-151`.

## Desired End State

- Menu „Pracownicy" → „Drukuj kosztorys pracownika (PDF)" opens „Drukuj kosztorys — ⟨imię⟩" with
  the checkbox ticked and „Drukuj". Ticked → only pozycje with his work; unticked → today's PDF.
- With the box ticked, section totals and the grand total add up exactly the printed rows.
- „Drukuj kartkę do zgłoszenia prac" is unchanged (one click, full scope).
- A worker with no work yet + box ticked prints an empty table (no guard, by decision).

### Key Discoveries:

- "Work done in his etapy" = `rowTotalQtyDone(row, stages, 'client') > 0` over the projection's
  stages — the predicate `protocolScopeRows` already uses (`acceptance-protocol/scope-rows.ts:12-13`).
- Columns are chosen by `workerDataHiddenColumns(rows, …)` over all rows (`worker.ts:108`); rows with
  no work in his etapy don't count as entries, so the filter changes no column. Leave it.
- `openPrintWindow` must run synchronously inside the click (`offer-print-action.tsx:27-28`); in the
  dialog that click is „Drukuj".
- Footer (`worker.summary`) is unaffected — hidden rows contribute 0 to his executed figures.

## What We're NOT Doing

- No persisted setting, no migration, no change to „Ustawienia widoku".
- No filter on the fill-in form, the live link page, report mode or the owner's preview.
- No empty-result guard / toast, no disabled state for a worker without entries.
- No per-worker attribution on a shared etap (`stage_progress` has no worker column) — co-members'
  work on his etap counts as his row.
- No item→trade assignment for the offer phase.

## Implementation Approach

Builder first (pure, testable in node), then the dialog that feeds it a boolean.

## Phase 1: Builder — own-work filter and totals over printed rows

### Overview

`buildWorkerPrintHtml` takes `ownWorkOnly` and computes every table total from the rows it prints.

### Changes Required:

#### 1. Worker PDF builder

**File**: `src/lib/kosztorys/print/worker.ts`

**Intent**: When `ownWorkOnly`, drop printed rows whose qty done over the projection's stages is
not > 0. Feed the printed rows (not all rows) to `totalsOf` and `groupBySection`, so totals equal
the visible table in both modes.

**Contract**: `buildWorkerPrintHtml(args: WorkerPrintArgsT & { ownWorkOnly: boolean })`.
`buildWorkerFormHtml` keeps `WorkerPrintArgsT` and is untouched. Column selection stays over all rows.

#### 2. Specs

**File**: `src/__tests__/lib/kosztorys/print/worker.test.ts`

**Intent**: Existing cases pass `ownWorkOnly: false` and must stay green unchanged (proves totals
over printed rows equal today's totals). New cases: ticked drops a pozycja with a Przedmiar and no
work in his etapy; ticked keeps a pozycja whose work is only in his etap (also on a shared etap);
ticked totals (section + grand) equal the sum of the printed rows; a section left with no rows
disappears; no work at all → no item rows.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker-form.test.ts` passes (form untouched)

#### Manual Verification:

- (covered in Phase 2)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Print dialog in the „Pracownicy" menu

### Overview

The PDF menu item opens one shared dialog; „Drukuj" runs today's print routine with the flag.

### Changes Required:

#### 1. Dialog state

**File**: `src/components/kosztorys/editor/actions/use-worker-actions.ts`

**Intent**: Add the print target and open state, mirroring `shareTarget`/`shareOpen`.

**Contract**: `WorkerActionsT` gains `printTarget: { id: number; name: string } | null`,
`printOpen`, `setPrintOpen`, `requestPrint(target)`.

#### 2. Print routine

**File**: `src/components/kosztorys/editor/actions/worker-print-action.tsx`

**Intent**: Extract the body of `handlePrint` into a hook-returned function both callers use: the
form menu item (unchanged behaviour) and the dialog. The PDF menu item calls
`worker.requestPrint({ id, name })` instead of printing. Keep the `blockReason` disable as today.

**Contract**: a print function taking `(workerId, variant, { ownWorkOnly })`; `openPrintWindow` stays
its first statement so it runs inside the triggering click.

#### 3. Dialog

**File**: `src/components/kosztorys/editor/dialogs/worker-print-dialog.tsx` (new)

**Intent**: `Dialog` + `DialogHeader` („Drukuj kosztorys — ⟨imię⟩") + `CheckboxRow` „Tylko pozycje z
wykonaną pracą" (description: „Pomija pozycje, w których jego etapy nie mają jeszcze wpisów. Sumy
liczą tylko wydrukowane pozycje.") + footer `Button` „Drukuj" that prints and closes. Checkbox state
resets to ticked on every open. Compose `ui/` primitives only, as `kosztorys-worker-view-dialog.tsx`
does.

**Contract**: reads `useKosztorysActions().worker`; mounted in
`editor/toolbar/menus/kosztorys-actions-menu.tsx` beside `KosztorysWorkerShareDialog`.

#### 4. Spec

**File**: `src/__tests__/components/kosztorys/editor/dialogs/worker-print-dialog.test.tsx` (new)

**Intent**: The checkbox opens ticked; „Drukuj" passes `ownWorkOnly: true`, unticking passes
`false`. Mock the print routine, not `window.open`.

#### 5. Domain note

**File**: `context/reference/kosztorys-editor-domain-notes.md` (worker view section, „PDF" bullet ~:469)

**Intent**: One sentence: the PDF asks „Tylko pozycje z wykonaną pracą" (default on); ticked, it
prints only pozycje with work in his etapy and totals only those; the kartka and the link keep the
whole scope.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/worker-print-dialog.test.tsx` passes
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx` passes

#### Manual Verification:

- Local (5433), Gryka-Deszczyński Kopernika 2a Marki → „Pracownicy" → Kyryl Elektryk → „Drukuj
  kosztorys pracownika (PDF)": dialog opens with the box ticked; „Drukuj" opens the print window
  (no popup block) with only his pozycje; section and grand totals match the printed rows.
- Same with the box unticked: PDF identical to today's (all pozycje with a Przedmiar).
- A worker whose etapy have no entries, box ticked: header, empty table, footer — no error.
- „Drukuj kartkę do zgłoszenia prac" still prints in one click with the full scope.

**Implementation Note**: When this phase's automated verification passes, commit.

---

## Testing Strategy

### Unit Tests:

- Builder: filter predicate, totals = printed rows, section disappearance, shared etap, `false` = today.

### Integration Tests:

- None — no DB or server-action change.

### Manual Testing Steps:

1. See Phase 2 Manual Verification.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Research + decisions: `context/changes/2026-10-22-worker-pdf-own-work-filter/research.md`
- Same predicate: `src/lib/kosztorys/acceptance-protocol/scope-rows.ts:7-13`
- Dialog pattern: `src/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx`

## Deviations (as built)

- **Print routine** lives in `actions/use-worker-print.ts` as `useWorkerPrint()` →
  `printWorker(workerId, build)`; the menu items in `worker-print-action.tsx` pass `buildWorkerFormHtml`
  or open the dialog, and the dialog passes `buildWorkerPrintHtml({ ...args, ownWorkOnly })`.
  `openPrintWindow` is still its first statement.
- **Dialog** is `dialogs/kosztorys-worker-print-dialog.tsx`; the description sits in `DialogHeader`
  (`CheckboxRow` has no description prop).
- **`WorkerActionsT`** also carries `printOwnWorkOnly` / `setPrintOwnWorkOnly`; `requestPrint` resets
  it to ticked, the same way `requestShare` resets its state.
- **Filter** goes through the registry's „z wykonaną pracą" condition (`HAS_MEASURED_QTY_CONDITION_ID`):
  `documentRows(rows, stages, hideEmptyRows, executedOnly)` engages it beside `client-empty`, so the
  PDF checkbox and the editor filter of the same name share one predicate.
- **Spec 2.1** — the dialog is covered in `kosztorys-workers-menu.test.tsx` („the PDF"), not a
  separate `worker-print-dialog.test.tsx`; 2.1 ticks with 2.2.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Builder — own-work filter and totals over printed rows

#### Automated

- [x] 1.1 worker.test.ts passes
- [x] 1.2 worker-form.test.ts passes

### Phase 2: Print dialog in the „Pracownicy" menu

#### Automated

- [x] 2.1 worker-print-dialog.test.tsx passes
- [x] 2.2 kosztorys-workers-menu.test.tsx passes
