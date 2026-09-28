# „Pozostało" — sum skips overrun rows, overrun cells red — Plan Brief

> Full plan: `context/changes/2026-09-28-kosztorys-remaining-skip-overrun/plan.md`
> Research: `context/changes/2026-09-28-kosztorys-remaining-skip-overrun/research.md`

## What & Why

The „Pozostało" footer and „Razem" net every row, so work done past the Przedmiar (e.g. „Prace
dodatkowe" with no Przedmiar) subtracts from the sum and hides how much of the offer is left.
EX-885 makes the sum read „ile oferty zostało do zrobienia" and moves the overrun signal onto the
row itself, in red. This deliberately reverses EX-686 (inv. 31).

## Starting Point

One loop, `columnTotalsForRows`, feeds the footer and „Razem" on every grid surface. Row figures
already go negative. `computedColumn` already supports a per-row red tone, used by „% wykonania".
No printout sums „Pozostało".

## Desired End State

- A footer or „Razem" „Pozostało" (netto, brutto, the worker's) sums only rows not over the
  przedmiar. In the inv. 139 example it reads 6825,00 instead of 6025,00.
- An overrun cell is red on every grid surface.
- The header tip explains the rule.
- Printouts are unchanged.

## Key Decisions Made

| Decision              | Choice                                                | Why (1 sentence)                                                    | Source            |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ----------------- |
| Where the sum changes | `columnTotalsForRows` only                            | It is the single summation path; brutto follows via `toGross`       | Research          |
| Row values            | Unchanged (stay negative)                             | Only the total's meaning changes                                    | Research / EX-885 |
| Red on printouts      | No                                                    | The owner's ruling; prints carry no „Pozostało" sum either          | Plan (owner)      |
| Red explanation       | Header tip only                                       | The same pattern as the red „% wykonania"; no per-cell repetition   | Plan              |
| Threshold             | < −`MONEY_TOLERANCE` (half a grosz)                   | Float noise must not paint „−0,00" red; the constant already exists | Plan              |
| Surfaces with red     | Every grid surface, investor preview included         | One rule, no branching                                              | Plan (owner)      |
| One predicate         | `isRemainingOverrun` drives both the skip and the red | Two readers of one rule cannot drift                                | Plan              |

## Scope

**In scope:**

- the predicate
- the totals loop
- tone on 3 grid columns
- the header tips
- the rationale comments
- the specs
- the domain-notes / formula-anomalies / domain-distillation docs

**Out of scope:**

- printouts
- per-cell tooltips
- the „% wykonania" red and „Problemy"
- the `sort-value.ts` view mismatch
- `roadmap.md:48`
- other figures named „Pozostało"

## Architecture / Approach

`isRemainingOverrun(value)` in `settlement-rows.ts` answers "past the przedmiar?". It has two
readers:

- `columnTotalsForRows` adds a row only when the answer is no. The skip is per row, so Σ footers =
  „Razem" still holds.
- The three grid columns pick `tone: 'danger'` when the answer is yes.

## Phases at a Glance

| Phase                            | What it delivers                                 | Key risk                                       |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| 1. Sum without overrun rows      | Predicate + totals + rewritten spec and comments | Pinning the old EX-686 assertions by mistake   |
| 2. Red overrun cells, tips, docs | Tone on 3 columns + header tips + living docs    | File collision with the in-flight EX-875 edits |

**Prerequisites:** the EX-875 worker-view work must be committed before Phase 2
(`kosztorys-v2-columns.tsx` and domain-notes are staged by that agent).

**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The inv. 139 example is prod-only; the local dump lacks the −800 row. Verify on staging or after
  `db:import`.
- A row over its przedmiar now shows two red cells („% wykonania" + „Pozostało"). This is
  accepted, per EX-885.

## Success Criteria (Summary)

- The owner reads the section „Pozostało" as the offer still to do; overrun rows no longer shrink it.
- Overrun rows are visibly red in the grid.
- Footers still add up to „Razem".
