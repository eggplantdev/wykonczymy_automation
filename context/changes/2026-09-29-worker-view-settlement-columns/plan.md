# Worker view: settlement columns on first entry, przedmiar hidden once work exists — Implementation Plan

## Overview

The worker's document (named link `/p/<name>/<token>`, the owner's „Podgląd" and the PDF) gets the
investor's data-driven column rule, plus one owner switch of its own:

1. **Before any entry in the worker's etapy** the settlement columns stay off — „Pomiar (razem
   etapy)", „Wartość wykonana netto" and the etap columns — exactly as the investor's document does.
2. **An etap without entries** is never on the worker's document.
3. **New firm-wide checkbox** in „Ustawienia widoku pracownika", **ticked by default**: once the
   worker's etapy carry any entry, „Przedmiar" and „Wartość przedmiaru netto" leave the document.
   Unticked, they stay.

Owner request 2026-09-29. Point 2 reverses the decision recorded at
`src/components/kosztorys/editor/grid/column-selection.ts:109` („an investor's empty etap is not a
reason to hide it from a crew").

## Current State Analysis

- The investor's document subtracts `emptySettlementColumnIds(rows, stages)`
  (`src/lib/kosztorys/settlement-columns.ts:27`) on top of the stored hidden set — in the editor via
  `previewHiddenColumns` (`use-kosztorys-editor.ts:525`), in the offer PDF by filtering printed
  columns on `column.key` (`src/lib/kosztorys/print/offer.ts:52`).
- The worker's document does neither. `previewHiddenColumns` is built only for `preview && !worker`,
  and `selectV2Columns` consults it only under `previewVisible`
  (`column-selection.ts:110`). The worker's stored hidden set is folded into his closed list by
  `workerVisibleColumns` (`worker-view/settings.ts`), which works on **logical group keys** — it
  cannot drop a single empty etap, whose ids are `stageKey(id)` / `stageValueNetKey(id)`.
- The link and the owner's Podgląd are one render (`WorkerKosztorysPage` → editor body with
  `preview` + `worker`), so the editor path covers both. The PDF is built separately in
  `buildWorkerPrintHtml` (`src/lib/kosztorys/print/worker.ts`) from the same projection.
- The projection's tree is already narrowed to the worker's etapy (`buildWorkerKosztorysData`,
  `lib/queries/worker-kosztorys.ts`), so `stagesWithEntries` over its rows/stages answers „has THIS
  worker's work started" by construction.
- Settings: global `kosztorys-worker-view-settings` (`src/globals/kosztorys-worker-view-settings.ts`),
  type + fail-closed sanitizer in `worker-view/settings.ts`, owner-only save in
  `lib/actions/kosztorys-worker-view.ts`, dialog in
  `editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx`. Table
  `kosztorys_worker_view_settings` (migrations `20260928_1`, `20260928_4`).

## Desired End State

- Worker whose etapy are all empty: document shows the offer shape — Opis, Przedmiar, j.m., Stawka,
  Wartość przedmiaru (+ Pozostało if ticked); no „Pomiar (razem etapy)", no „Wartość wykonana", no
  etap columns — regardless of the new checkbox.
- Worker with an entry in any of his etapy, checkbox ticked (default): no Przedmiar, no Wartość
  przedmiaru netto; the filled etapy, Σ etapów and Wartość wykonana appear; empty etapy stay off.
- Same, checkbox unticked: Przedmiar and Wartość przedmiaru netto stay beside the settlement columns.
- Link, owner's Podgląd and PDF show the identical column set in every one of these states.

### Key Discoveries:

- One pure function feeds both render paths, so they cannot drift — the same contract the offer and
  the investor's podgląd already share through `emptySettlementColumnIds`.
- Hidden ids must be **full column ids** (per-etap), not the picker's group keys — subtracting the
  group would take filled etapy with the empty ones (`settlement-columns.ts:21`).
- `SETTLEMENT_TOTAL_COLUMNS` holds `stageQtySum`, `net`, `donePercent`, `discountAmount`; the last two
  are outside the worker ceiling and are inert there. `remainingForPlane` is deliberately not in it
  („Pozostało" is a real figure before any work — owner, 2026-09-28), and the new checkbox does not
  touch it either.

## Decisions taken without a question round (owner said the scope is simple — veto any)

| Decision                                          | Choice                                                  | Why                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| „Pozostało netto (względem przedmiaru)"           | Not governed by the new checkbox; keeps its own tick    | The request named only Przedmiar and Wartość przedmiaru netto                              |
| Summary block „Wartość przedmiaru (Twoja stawka)" | Unchanged — the checkbox governs table columns only     | It is the worker's contracted total, and the request is about columns                      |
| Investor view                                     | Unchanged; no equivalent checkbox                       | „tak samo jak u inwestora" = the reveal-on-first-entry and empty-etap rules it already has |
| „Work exists"                                     | Any non-zero quantity in any of **this worker's** etapy | Tree is his etapy only; another crew's entry must not reshape his document                 |

## What We're NOT Doing

- No change to the investor's document, its dialog or the offer PDF.
- No change to the worker summary/footer figures.
- No per-investment override of the worker settings (still one set for the firm).
- No change to what the worker may ever see (the ceiling `WORKER_VIEW_GROUPS` is untouched) — this
  only subtracts.

## Implementation Approach

Add the boolean to the settings (field + migration + sanitizer + dialog), then one pure function
`workerDataHiddenColumns(rows, stages, hidePlannedOnceExecuted)` returning full column ids, consumed
by the editor (link + Podgląd) and by the worker PDF. The editor's existing „document hidden set"
seam (`previewHiddenColumns`) is extended to the worker surface instead of adding a second one, and
renamed to `documentHiddenColumns` since it now serves both audiences.

## Phase 1: The setting

### Overview

Persist and edit „hide przedmiar once work exists", default on.

### Changes Required:

#### 1. Global + migration

**File**: `src/globals/kosztorys-worker-view-settings.ts`, `src/migrations/20260929_5_worker_view_hide_planned.ts`, `src/migrations/index.ts`

**Intent**: Store the new boolean on the firm-wide global. Additive, hand-written migration (see
AGENTS.md — `migrate:create` drifts).

**Contract**: field `hidePlannedOnceExecuted: checkbox, defaultValue: true`; column
`hide_planned_once_executed boolean DEFAULT true` via `ADD COLUMN IF NOT EXISTS`; `down` drops it.
Additive → on deploy, prod migrate **before** push (human, `pnpm db:migrate:prod`).

#### 2. Type + sanitizer

**File**: `src/lib/kosztorys/worker-view/settings.ts`

**Intent**: Carry the flag through the one sanitizer every read and write passes.

**Contract**: `WorkerViewSettingsT.hidePlannedOnceExecuted: boolean`; default `true`; sanitized as
`!== false` (a missing row / NULL / garbage reads as the default, like `hideEmptyRows`).

#### 3. Dialog

**File**: `src/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx`

**Intent**: A checkbox beside the shared fields (worker-only, so NOT in the shared
`ViewSettingsFields`), plus the investor dialog's explanatory line adapted to the worker: settlement
columns appear only after the first entry in his etapy; an etap without entries stays hidden.

**Contract**: `CheckboxRow` bound to `draft.hidePlannedOnceExecuted`, label along the lines of
„Ukryj przedmiar i jego wartość, gdy w etapach są już wpisy", disabled under the same `!mayWrite`
gate as the rest.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/kosztorys/worker-view/settings.test.ts` covers default true, stored `false`
  survives, non-boolean/missing reads as true: `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-view/settings.test.ts`
- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations`)

#### Manual Verification:

- „Ustawienia widoku pracownika" shows the new checkbox ticked on a fresh firm; unticking + Zapisz
  persists across a reload; a MANAGER sees it disabled.

---

## Phase 2: The column rule on all three surfaces

### Overview

Apply the reveal-on-first-entry rule, hide empty etapy, and honour the new flag — on link, Podgląd
and PDF alike.

### Changes Required:

#### 1. Pure rule

**File**: `src/lib/kosztorys/worker-view/columns.ts`

**Intent**: Single answer to „which columns does the data take off the worker's document".

**Contract**: `workerDataHiddenColumns(rows, stages, hidePlannedOnceExecuted): ReadonlySet<string>` =
`emptySettlementColumnIds(rows, stages)` ∪ (`hidePlannedOnceExecuted` && `stagesWithEntries(rows,
stages).length > 0` ? `{'plannedQty', 'plannedNetForPlane'}` : ∅). Full column ids. Callers pass the
unfiltered projection rows (same reason as `settlement-columns.ts:22`).

#### 2. Editor (link + owner's Podgląd)

**Files**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`,
`src/components/kosztorys/editor/grid/column-selection.ts`,
`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts` (opts type), affected specs

**Intent**: Build the document hidden set for the worker too (`preview && worker` →
`workerDataHiddenColumns(rows, stages, worker.settings.hidePlannedOnceExecuted)`), and let
`selectV2Columns` subtract it under the worker's closed list as it already does under the
investor's. Rename `previewHiddenColumns` → `documentHiddenColumns` (it now serves both documents)
and rewrite the two comments that state the opposite rule (`column-selection.ts:109`,
`use-kosztorys-editor.ts:523`).

**Contract**: `BuildV2ColumnsOptsT.documentHiddenColumns?: ReadonlySet<string>`, honoured when
`previewVisible` **or** `workerSurface` is set; still subtract-only against the closed list.

#### 3. PDF

**File**: `src/lib/kosztorys/print/worker.ts`

**Intent**: Filter the printed columns by the same set, on `column.key`, the way `offer.ts` filters
`emptySettlementColumnIds`.

**Contract**: `buildWorkerPrintHtml` filters `workerPrintColumns(...)` output with
`workerDataHiddenColumns(rows, stages, worker.settings.hidePlannedOnceExecuted)`.

#### 4. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md` („Widok pracownika", ~l. 374)

**Intent**: Record the rule: settlement columns on first entry in his etapy, empty etapy hidden,
the przedmiar switch (default on) and that „Pozostało" and the summary are not governed by it.

### Success Criteria:

#### Automated Verification:

- Unit spec for `workerDataHiddenColumns` (no entries → settlement + all etap ids, przedmiar kept;
  entries + flag → przedmiar pair added, filled etap kept, empty etap hidden; entries + no flag →
  przedmiar pair kept): `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-view/columns.test.ts`
- Grid spec — worker surface drops empty etap and, with the flag, the przedmiar pair:
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/worker-columns.test.ts`
- Investor preview unchanged after the rename: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`
- PDF spec — printed headers follow the same three states: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker.test.ts`

#### Manual Verification:

- Worker with all etapy empty: link / Podgląd / PDF show Przedmiar + Wartość przedmiaru, no Pomiar,
  no Wartość wykonana, no etap columns.
- Add one quantity in one of his etapy: Przedmiar + Wartość przedmiaru disappear; that etap, Σ etapów
  and Wartość wykonana appear; his other, empty etap does not.
- Untick the checkbox → Przedmiar + Wartość przedmiaru come back next to the settlement columns on
  all three surfaces.
- An entry in ANOTHER crew's etap does not change this worker's document.

---

## Testing Strategy

The rule is pure (rows, stages, flag → ids), so the weight sits in its unit spec; the grid and PDF
specs assert each surface actually consumes it (header sets), which is where drift would appear.

## Migration Notes

Additive column with `DEFAULT true`; existing (or absent) settings row reads as „on". Prod migrate
before the push that ships the code.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## References

- Investor rule: `src/lib/kosztorys/settlement-columns.ts`, `src/lib/kosztorys/print/offer.ts:52`
- Worker surface wiring: `src/components/kosztorys/editor/use-kosztorys-editor.ts:525-585`,
  `src/components/kosztorys/editor/grid/column-selection.ts:70-120`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The setting

#### Automated

- [x] 1.1 Settings spec covers default, stored false, garbage — 5c37d4b5
- [x] 1.2 Migration applies to the local DB — 5c37d4b5

### Phase 2: The column rule on all three surfaces

#### Automated

- [x] 2.1 Unit spec for workerDataHiddenColumns — 611e4edf
- [x] 2.2 Grid worker-columns spec — 611e4edf
- [x] 2.3 Investor preview-columns spec unchanged after rename — 611e4edf
- [x] 2.4 Worker PDF spec — 611e4edf
