# Simple arithmetic in kosztorys grid number cells — Plan Brief

> Full plan: `context/changes/2026-10-07-kosztorys-cell-arithmetic/plan.md`

## What & Why

Every numeric cell of the kosztorys editor grid accepts a simple expression — `+ − * /`, `x`/`×`,
parentheses, optional `=` — and stores the result as a number rounded to 2 places. The owner
computes a quantity in the cell („3,5x2,8") the way they do in the sheet, instead of on a calculator.

## Starting Point

All grid numeric cells read input through one function, `parseCellDecimal`, which accepts only a
single number; anything else is held while typing and rolled back on leaving.

## Desired End State

`3,5x2,8` → 9,8; `=10/3` → 3,33; `(2+3)*1,5` → 7,5 — typed or pasted, in any grid number cell. A
malformed expression behaves like garbage today. Plain numbers and every form field are unchanged.

## Key Decisions Made

| Decision        | Choice                         | Why (1 sentence)                                                        |
| --------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Multiplication  | `*`, `x`, `X`, `×`             | „3,5x2,8" is how room dimensions are written.                            |
| Rounding        | 2 places, expressions only     | 10/3 must not show a float tail; plain numbers keep today's round trip. |
| Scope           | Editor grid only               | One seam; forms stay strict on purpose, the worker's phone keypad has no operators. |
| Engine          | Hand-written recursive descent | No `eval`, no dependency, ~50 lines, fully unit-testable.               |
| Expression kept | No — only the result           | Cell references / stored formulas are a different feature.               |

## Scope

**In scope:** evaluator module, fallback in `parseCellDecimal`, unit specs.

**Out of scope:** cell references, functions, `%`, storing the formula, forms, worker report grid, any UI.

## Architecture / Approach

`parseCellDecimal` → plain parse; on `invalid` only → `evaluateArithmetic` → `roundToCents`. The cell
contract (`cell-edit.ts`) and all cells inherit it with no call-site edits.

## Phases at a Glance

| Phase                                     | What it delivers               | Key risk                                             |
| ----------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| 1. Evaluator behind `parseCellDecimal`    | Arithmetic in every grid cell  | Breaking the `decimalText` round trip for plain numbers |

**Prerequisites:** none.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- Live commit mid-typing writes intermediate results (`=2*3` → 2, then 6) — same as typing a number today, and the settle rule rolls back an invalid final text.
- A guarded subcontractor price may refuse an intermediate value; only the final text decides on leaving.

## Success Criteria (Summary)

- The owner types `3,5x2,8` into Przedmiar and sees 9,8 with the row's value recomputed.
- Nothing that parses today parses differently.
