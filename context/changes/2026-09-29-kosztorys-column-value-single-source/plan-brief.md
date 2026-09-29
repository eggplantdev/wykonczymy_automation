# Kosztorys column values — single source — Plan Brief

> Full plan: `context/changes/2026-09-29-kosztorys-column-value-single-source/plan.md`

## What & Why

Each computed kosztorys column's per-row figure is composed four times — grid cell, sort key,
section/„Razem" totals, PDF prints — with nothing forcing agreement. It has drifted twice (EX-487,
EX-894: crew-view sort by „Wartość przedmiaru netto" / „% wykonania" / „Pozostało netto" follows the
crew price while the cells show the client price). One resolver, read by all four, ends the class.

## Starting Point

`assembleV2Columns` passes inline compute closures to `computedColumn`; `columnSortValue` re-derives
them in a `switch`; `columnTotalsForRows` and the print builders re-derive them again. The owner's
2026-09-23 ruling (`3400f9b2`) pinned the cells and totals to the client price but missed the sort.

## Desired End State

`src/lib/kosztorys/column-values.ts` composes every computed column's value; the four surfaces keep
only formatting / tone / summation / null-sinking. Parity specs iterate the real assembled columns, so
a new computed column is covered the day it's added. No displayed or printed number changes.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| EX-894 direction | Sort follows the cell (`'client'`) | Owner ruling 2026-09-23 — przedmiar figures read at the client price in every view |
| Scope | Grid + sort + totals + prints | User: "don't want to go back to this" |
| Shape | Resolver factory `columnValueResolver(ctx)(id)` | Needs ctx (stages, view, worker qty) and the per-row `totalQtyDone` memo |
| Drift guard | Parity spec over ASSEMBLED columns | A hand-kept list would itself drift |
| Editable columns | Out of the resolver | No computed composition; already share `viewPrice` / `shownCoeff` |
| Per-etap totals | Stay on `stageAxisForView`, pinned by parity spec | Prices each row once for all etapy (perf) |

## Scope

**In scope:** resolver module; sort, grid, totals, print consumers; EX-894 fix; stale comment at
`kosztorys-v2-columns.tsx:299`; parity specs; manual checks.

**Out of scope:** editable columns, section subtotals/summary panel, sheet-import, history diff,
worker-surface sort, any change to a figure's meaning.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Resolver + sort (TDD) | EX-894 fixed, sort reads resolver | Signature churn at `row-view.ts` |
| 2. Grid + parity spec | Cells read resolver; cell≡sort enforced | Losing the per-row memo → slow 1000-row grid |
| 3. Totals | Totals Σ resolver; total≡Σcells enforced | Overrun skip / brutto rounding regressions |
| 4. Prints | PDFs read resolver | Collides with parallel `print/` restructure — gated on it being committed |

**Prerequisites:** Phase 4 waits until `src/lib/kosztorys/print/` is clean in `git status`.
**Estimated effort:** ~1 session.

## Open Risks & Assumptions

- The parallel `print/` rename may change `PrintColumnT` or the builders' shape; Phase 4 re-reads them.

## Success Criteria (Summary)

- In a crew view, sorting any computed column orders rows by the numbers on screen.
- No cell, total or printed figure changes.
- A future computed column that computes its sort or cell separately fails the parity spec.
