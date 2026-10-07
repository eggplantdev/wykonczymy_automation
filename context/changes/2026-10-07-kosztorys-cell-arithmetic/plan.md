# Simple arithmetic in kosztorys grid number cells — Implementation Plan

## Overview

Let every numeric cell of the kosztorys editor grid accept a simple arithmetic expression —
`+ − * /`, `x`/`×` as multiplication, parentheses, an optional leading `=` — and store its result as
a plain number rounded to 2 decimal places. The owner computes quantities in the cell the way they
do in the sheet („3,5x2,8", „=12+4"), without a calculator on the side. The expression itself is not
stored.

## Current State Analysis

- `react-datasheet-grid` has no formula engine; a cell is just data.
- Every numeric cell of the editor grid — `decimalColumn` (Przedmiar, Cena j.m., stage quantities),
  the rabat pair (`discount-columns.tsx`), the subcontractor coeff/price cells,
  `current-planned-qty-cell.tsx`, `report-column.tsx` — runs on the contract in
  `src/lib/kosztorys/cell-edit.ts`, whose three entry points (`cellKeystroke`, `cellSettle`,
  `cellPaste`) all read the text through **one** function: `parseCellDecimal`
  (`src/lib/utils/parse-decimal-input.ts:23`).
- `parseCellDecimal` = strip all whitespace (NBSP thousands separator from a sheet paste) →
  `parseDecimalInput`, which replaces the **first** comma with a dot and does `Number(...)`. Anything
  that isn't a single number is `invalid`.
- `parseDecimalInput` is the strict parse for forms and is shared by ~10 non-grid call sites
  (forms, worker report grid, settings fields). lessons.md („A library's ready-made numeric column
  parses a comma as a PREFIX…") records that its three-way result is load-bearing and must not move.

## Desired End State

In the editor grid, typing or pasting `3,5x2,8`, `3,5*2,8`, `=12+4`, `(2+3)*1,5`, `10/3` into any
numeric cell commits `9,8`, `9,8`, `16`, `7,5`, `3,33`. A malformed expression (`2*`, `2*/3`, `1/0`,
`=`) behaves exactly like garbage today: held while typing, rolled back with the existing
„invalid" notice on leaving if it displaced a committed prefix, ignored on paste. A plain number is
parsed exactly as today (no rounding, `1e3` and the round trip with `decimalText` unchanged). Forms,
the worker report grid and every other `parseDecimalInput` caller are untouched.

### Key Discoveries:

- Single seam: `parseCellDecimal` is the only parser `cell-edit.ts` calls (`cell-edit.ts:63,90,117`).
- Keystrokes commit as they go (`use-cell-draft.ts:32-42`): `=2*3` commits 2, holds at `2*`, commits 6. The draft text stays on screen until the cell is left, so the computed columns update live and
  no preview UI is needed.
- `roundToCents` (`src/lib/utils/round-to-cents.ts`) already rounds half away from zero with the
  float-residue trim — reuse it, don't write a second rounding.
- `decimalText` round trip is pinned by `parse-decimal-input.test.ts:34-51`; plain numbers must keep
  bypassing the evaluator so it stays green.

## What We're NOT Doing

- Cell references (`=D5*2`), functions (`SUM`), `%`, exponents in expressions.
- Storing or re-showing the expression after the cell is left.
- Any change to `parseDecimalInput` / `toMoney` or their form, settings and worker-report callers.
- UI changes (no preview, no hint, no new notice text).

## Implementation Approach

A small, React-free, hand-written recursive-descent evaluator (no `eval`, no `Function`, no
dependency) in its own module; `parseCellDecimal` falls back to it only when the plain parse says
`invalid`. All grid surfaces inherit the behaviour through `cell-edit.ts` with zero call-site edits.

## Phase 1: Expression evaluator behind `parseCellDecimal`

### Overview

Add the evaluator, wire it into `parseCellDecimal`, cover it with unit specs.

### Changes Required:

#### 1. Evaluator

**File**: `src/lib/utils/evaluate-arithmetic.ts` (new)

**Intent**: Turn a whitespace-free expression string into a finite number or `null`. Pure, no
domain knowledge.

**Contract**: `evaluateArithmetic(expression: string): number | null`.

- Grammar: optional single leading `=`; `expr := term (('+'|'-') term)*`; `term := factor (('*'|'x'|'X'|'×'|'/') factor)*`;
  `factor := ('+'|'-') factor | number | '(' expr ')'`; `number := digits ([.,] digits?)? | [.,] digits`.
- Every comma is a decimal separator (`1,5*2,5`), so the commas are NOT pre-replaced with a single
  `.replace(',', '.')` the way `parseDecimalInput` does.
- Returns `null` on: any unconsumed input, an empty operand, unbalanced parentheses, a lone `=`, a
  non-finite result (division by zero).

#### 2. Wire into the grid parse

**File**: `src/lib/utils/parse-decimal-input.ts`

**Intent**: `parseCellDecimal` tries the plain parse first; only when it returns `invalid` does it
try the evaluator, and a non-null result becomes `{ kind: 'value', value: roundToCents(result) }`.
Update the comment above `parseCellDecimal` to say the grid also accepts arithmetic (and why the
forms don't — there, strictness catches typos).

**Contract**: `parseCellDecimal(raw: string): DecimalInputParseT` — signature unchanged;
`parseDecimalInput` and `toMoney` unchanged. Plain numbers never reach the evaluator and are never
rounded.

#### 3. Specs

**File**: `src/__tests__/lib/utils/evaluate-arithmetic.test.ts` (new) and
`src/__tests__/lib/utils/parse-decimal-input.test.ts`

**Intent**: Pin the grammar and the grid seam.

- Evaluator: precedence (`2+3*4` = 14), parentheses, left associativity (`10-2-3` = 5, `12/2/3` = 2),
  unary minus (`-3*2`, `2*-3`), `x`/`X`/`×`, leading `=`, comma decimals; `null` for `2*`, `*2`,
  `2**3`, `(2+3`, `2+3)`, `=`, `1/0`, `2(3)`, `abc`.
- `parseCellDecimal`: `'3,5x2,8'` → 9.8, `'10/3'` → 3.33, `'= 2 + 2'` (whitespace) → 4, `'2*'` →
  invalid; existing round-trip and NBSP cases stay green; `parseDecimalInput('2*3')` still invalid
  (forms stay strict).
- `src/__tests__/lib/kosztorys/cell-edit.test.ts`: one `cellPaste` case pasting `'3,5x2'` → 7, so
  the contract's tie to the grid parse is pinned at the layer the cells use.

### Success Criteria:

#### Automated Verification:

- Evaluator spec passes: `pnpm exec vitest run src/__tests__/lib/utils/evaluate-arithmetic.test.ts`
- Parse spec passes: `pnpm exec vitest run src/__tests__/lib/utils/parse-decimal-input.test.ts`
- Cell-edit spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/cell-edit.test.ts`

#### Manual Verification:

- In the kosztorys editor, typing `3,5x2,8` into „Przedmiar" and pressing Enter leaves `9,8` in the
  cell and the row's „Wartość netto przedmiar" recomputes.
- Typing `=10/3` into „Cena j.m." leaves `3,33`.
- Typing `2*` and leaving the cell rolls back to the previous value with the existing notice.
- Pasting `(2+3)*1,5` onto a selected stage-quantity cell lands `7,5`.
- A plain number (`12,5`) still behaves exactly as before.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
not pause for per-phase manual confirmation.

---

## Testing Strategy

### Unit Tests:

- Grammar and failure modes in `evaluate-arithmetic.test.ts`; the grid seam and the forms-stay-strict
  guard in `parse-decimal-input.test.ts`; one paste case in `cell-edit.test.ts`.

### Integration Tests:

- None — the change is a pure function below an already-tested contract; no DB, action or
  revalidation path changes.

### Manual Testing Steps:

1. Open an investment's kosztorys editor, type `3,5x2,8` into „Przedmiar", press Enter.
2. Type `2*` into another cell and click away — expect rollback + notice.
3. Copy `(2+3)*1,5` from a text editor, paste onto a stage quantity cell.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

## References

- Single parse seam: `src/lib/kosztorys/cell-edit.ts:63,90,117`
- Live-commit draft lifecycle: `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts`
- Rounding helper: `src/lib/utils/round-to-cents.ts`
- Prior parse decisions: `context/foundation/lessons.md` — „A library's ready-made numeric column
  parses a comma as a PREFIX…"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Expression evaluator behind `parseCellDecimal`

#### Automated

- [x] 1.1 Evaluator spec passes — 8c31df99
- [x] 1.2 Parse spec passes — 8c31df99
- [x] 1.3 Cell-edit spec passes — 8c31df99
