# „Pozostało" — sum skips overrun rows, overrun cells red — Implementation Plan

## Overview

EX-885. The „Pozostało" section footer and „Razem" sum every row, so a row executed past its
Przedmiar (typically „Prace dodatkowe" with no Przedmiar → −wykonane) lowers the sum and hides how
much of the offer is still to do. After this change the sums take only rows that are not over the
przedmiar, and an over-przedmiar cell renders red in the grid. The row figure itself is unchanged.

This deliberately reverses EX-686 (`7f586e0f`, 2026-08-13, the inv. 31 incident): the sum now reads
„ile oferty zostało do zrobienia", and overrun is signalled per row in red instead of by netting it
out of the sum.

## Current State Analysis

- One summation loop serves the footer and „Razem" on every surface that renders the grid: owner
  editor, `/k/[token]`, investor preview, worker page (`column-totals.ts:57-70`).
- `remainingGross` = `toGross(remaining)` (`:78`), so it follows the netto sum.
- `remainingForPlane` is summed in the same loop only when `executedQtyByItem` is passed (worker
  surface).
- No printout carries a „Pozostało" total. Row values stay negative (`settlement-rows.ts:58-78`).
- `computedColumn` already supports a per-row `tone: 'muted' | 'danger'`
  (`computed-cell.tsx:57-81`), and `'danger'` → `text-destructive`, red on the preview too.
  `donePercent` is the precedent (`kosztorys-v2-columns.tsx:309`).
- A half-grosz money tolerance already exists: `MONEY_TOLERANCE = 0.005` (`calc.ts:16`).

## Desired End State

- In any section, the „Pozostało" footer = Σ of that section's rows whose Pozostało ≥ −0,005 zł.
  „Razem" = Σ of the footers. The same holds for „Pozostało brutto" and the worker's „Pozostało".
- Example (inv. 139 „Prace dodatkowe"): 750 + 1200 + 375 + 1000 + 200 + 1800 + 1500 − 800 reads
  **6825,00**, not 6025,00.
- A „Pozostało" / „Pozostało brutto" / worker „Pozostało" cell below −0,005 zł renders red on every
  grid surface: owner, worker, client link, investor preview. A cell at a float-noise „−0,00" stays
  muted.
- The header tips say the sum skips rows on the minus.
- Printouts are unchanged and stay black.

### Key Discoveries:

- `src/lib/kosztorys/column-totals.ts:66,68` — the two accumulation lines to guard.
- `src/lib/kosztorys/column-totals.ts:26-27` — the docblock rule "a total that is not a sum of its
  own cells stays blank". The clipped sum needs a stated exception.
- `src/lib/kosztorys/settlement-rows.ts:45-57` — the EX-686 rationale, to rewrite.
- `src/lib/kosztorys/calc.ts:16` — `MONEY_TOLERANCE` to reuse; no new constant.
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:353-370` — the three columns.
- `src/lib/kosztorys/header-tips.ts:13,31-34` — `REMAINING` and the `remainingForPlane` tip.
- `src/__tests__/components/kosztorys/editor/grid/stage-plane-lock.test.ts` — the node-spec pattern
  for reading `columnData` off `buildV2Columns`.

## What We're NOT Doing

- **Row values stay as they are.** No change to `rowRemainingForView` /
  `rowRemainingForExecutedQty`, which stay negative.
- **Printouts are untouched.** No red and no sum there (owner, 2026-09-28).
- **No per-cell tooltip on red cells.** The header tip carries the explanation, as with the red
  „% wykonania".
- **No change to the red „% wykonania"** (`hasStagesOverPlanned`) and no change to the „Problemy"
  `work-without-planned-qty` condition. The two red signals co-exist on a row over its przedmiar.
- **No fix to the pre-existing sort mismatch** in `sort-value.ts:124-127`, which prices at the active
  view while the cell is pinned to `'client'`.
- **No edit to `context/foundation/roadmap.md:48`.** It is a historical slice finding; the living
  correction goes in domain-notes.
- **Different figures named „Pozostało" are out of scope:** do zapłaty, do wypłaty, do rozliczenia.

## Implementation Approach

One predicate decides "this row is over the przedmiar", and both effects read it: the sum skips the
row, and the cell turns red. Two readers of one rule cannot drift. The Σ footers = „Razem"
invariant survives because the skip is per row.

## Critical Implementation Details

- **Sequencing.** `kosztorys-v2-columns.tsx`, `column-headers.tsx` and
  `kosztorys-editor-domain-notes.md` are currently **staged by the EX-875 worker-view agent**. Start
  Phase 2 only after that work is committed. Phase 1 touches only `column-totals.ts`,
  `settlement-rows.ts` and the test, which are clear today. Commit by pathspec.

## Phase 1: Sum without overrun rows

### Overview

Introduce the predicate, and apply it to the `remaining` and `remainingForPlane` accumulators.
Rewrite the rationale comments and the spec.

### Changes Required:

#### 1. Overrun predicate

**File**: `src/lib/kosztorys/settlement-rows.ts`

**Intent**: Add one exported predicate answering "is this Pozostało value work past the
przedmiar?", so the sum and the red cell cannot disagree. Rewrite the `rowRemainingForView`
comment:

- keep why a no-Przedmiar row is −wykonane (an offer of zero, not an absent answer);
- replace the argument for counting it into the sum with the new reading: the total is „ile oferty
  zostało do zrobienia"; an overrun row stays negative on its own line, in red, and the total skips
  it (EX-885 reversing EX-686; inv. 31 was the case that motivated the old rule).

**Contract**: `isRemainingOverrun(value: number): boolean` → `value < -MONEY_TOLERANCE`, with
`MONEY_TOLERANCE` imported from `calc.ts`. A value in `[-0.005, 0)` is float noise: it is not an
overrun, it sums, and it stays muted.

#### 2. Totals skip overrun rows

**File**: `src/lib/kosztorys/column-totals.ts`

**Intent**: Compute each row's `remaining` and, on the worker surface, `remainingForPlane` once. Add
it to the accumulator only when the predicate says it is not an overrun. `remainingGross` inherits
this through `toGross`. In the docblock, record the exception to the "total = sum of its own cells"
rule: this column's total deliberately sums only rows not over the przedmiar, and says why.

**Contract**: The `columnTotalsForRows` signature and returned keys are unchanged; only the values
of `remaining`, `remainingGross` and `remainingForPlane` change. Σ(section totals) = grand total
still holds.

#### 3. Spec

**File**: `src/__tests__/lib/kosztorys/column-totals.test.ts`

**Intent**: Rewrite the tests that pin the EX-686 rule, and pin the new one.

**Contract**:

- `:88-98`: rename the test and rewrite its comment. Row 3 alone → `remaining` is `0`; section B →
  `60`.
- `:125`: worker `remainingForPlane` → `48` (row 3's −12 skipped). Keep the „own-etapy" contrast
  comment accurate.
- New test: a section shaped like the issue's inv. 139 — several positive rows plus one row over its
  przedmiar. The total equals the positive sum, and `remainingGross` = `toGross` of it.
- New test: `isRemainingOverrun` at the boundary — −0.004 is not an overrun, −0.006 is, and 0 is
  not. It goes in a new `src/__tests__/lib/kosztorys/settlement-rows.test.ts`, which mirrors the
  source path; no such spec exists yet.
- The existing Σ-footers = „Razem" test (`:77-86`) stays unchanged and must still pass.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/column-totals.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-rows.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts` still passes (row
  values unchanged)

#### Manual Verification:

- On a kosztorys with a „Prace dodatkowe" row executed with no Przedmiar, the section footer
  „Pozostało" excludes that row, and „Razem" equals Σ of the footers.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Red overrun cells, tips, docs

### Overview

Tone the three „Pozostało" columns off the same predicate, extend the header tips, and correct the
living docs.

### Changes Required:

#### 1. Grid tone

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Give `remaining`, `remainingGross` and `remainingForPlane` a per-row `tone`: `'danger'`
when `isRemainingOverrun(value)` holds, `'muted'` otherwise.

- **Surfaces:** no `previewVisible` or `workerSurface` branching; red on every surface (owner,
  2026-09-28).
- **Tooltip:** no per-cell `tip`.
- **Gross column:** judge by the netto value. The sign is the same, and it keeps one tolerance axis.

**Contract**: The column ids and compute functions are unchanged; only the `style.tone` argument of
`computedColumn` is added.

#### 2. Header tips

**File**: `src/lib/kosztorys/header-tips.ts`

**Intent**: Add to `REMAINING` and to the `remainingForPlane` tip that the sum skips rows on the
minus. Keep the existing lines.

**Contract**: The copy lives at `REMAINING` (`:13`) and `remainingForPlane` (`:33-34`). Wording
direction: „Na minusie (na czerwono) = przekroczono przedmiar; suma w stopce pomija takie wiersze."

#### 3. Tone spec

**File**: `src/__tests__/components/kosztorys/editor/grid/remaining-overrun-tone.test.ts` (new)

**Intent**: Pin that the three columns resolve `'danger'` on an overrun row and `'muted'` on a
positive row and on a −0.004 row. Read `columnData.tone` off `buildV2Columns` as
`stage-plane-lock.test.ts` does. Build `remainingForPlane` with `workerSurface` set.

**Contract**: A node spec (`.test.ts`); no DOM.

#### 4. Living docs

**Files**:

- `context/reference/kosztorys-editor-domain-notes.md`
  - `:404-406`: replace „przy pustym Przedmiarze „—"" (stale since EX-686) with: an empty Przedmiar
    reads −wykonane; a row below −0,005 zł is red; the footer and „Razem" sum only rows that are
    not over the przedmiar. Note that this reverses EX-686.
  - `:106`: correct „1:1 … `rowRemainingForView` = `AF`". Pozostało deliberately anchors on S, not
    on the sheet's AF, which is identically zero.
  - `:374-375` (worker view): add that the worker's sum skips rows on the minus too.
  - `:415-418`: add the second red signal (negative „Pozostało"), beside the red „% wykonania".
- `context/reference/kosztorys-sheet/formula-anomalies.md:43-44`: the row still reads minus but no
  longer lowers the sum.
- `context/domain/01-domain-distillation.md:115-116`: append the sum rule to invariant 2.

**Intent**: The docs state the new rule and stop contradicting the code.

**Contract**: Prose only; the named bullets and lines.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/remaining-overrun-tone.test.ts` passes
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/stage-plane-lock.test.ts src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts` still pass

#### Manual Verification:

- In the owner's editor, a „Prace dodatkowe" row executed without Przedmiar shows „Pozostało" and
  „Pozostało brutto" in red. A row executed exactly to its Przedmiar shows 0,00 in muted grey, not
  red.
- On the worker page, an overrun row's „Pozostało" is red and the worker's footer skips it.
- In the investor preview with „Pozostało" shown, the overrun row is red too.
- Hovering the „Pozostało" header shows the new sentence about the sum.
- The offer PDF and the worker PDF print the negative row in black, as before.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

Anchored on test-plan risk **#1** (two surfaces disagree): the footer and „Razem" are the same
figure at two scopes, and the new rule must keep Σ footers = „Razem".

### Unit Tests:

- `column-totals.test.ts`: the new rule on `remaining`, `remainingGross`, `remainingForPlane`;
  Σ-footers invariant kept.
- The `isRemainingOverrun` boundary at ±half a grosz.
- Tone resolution on the three columns.

### Integration Tests:

- None. No DB or action path changes.

### Manual Testing Steps:

1. Open a kosztorys with an overrun row, and check that the footer skips it and the cell is red.
2. Check the worker page for the same.
3. Print the offer and the worker PDF, and check they are unchanged.

## Performance Considerations

None. It is the same loop and the same per-row compute; the tone callback repeats one `compute`
per rendered cell, as `donePercent` already does.

## Migration Notes

None. It is computed on read and nothing is stored.

## Whole-tree Gate

Run once, after Phase 2.

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## References

- Research: `context/changes/2026-09-28-kosztorys-remaining-skip-overrun/research.md`
- Linear: EX-885 (reverses EX-686, `7f586e0f`)
- Tone precedent: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:301-314`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sum without overrun rows

#### Automated

- [x] 1.1 `pnpm exec vitest run src/__tests__/lib/kosztorys/column-totals.test.ts` passes — cae0bf78
- [x] 1.2 `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-rows.test.ts` passes — cae0bf78
- [x] 1.3 `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts` still passes (row values unchanged) — cae0bf78

### Phase 2: Red overrun cells, tips, docs

#### Automated

- [x] 2.1 `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/remaining-overrun-tone.test.ts` passes — 56ab923a
- [x] 2.2 `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/stage-plane-lock.test.ts src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts` still pass — 56ab923a
