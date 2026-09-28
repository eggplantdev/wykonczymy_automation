---
date: 2026-09-28T17:28:43+02:00
researcher: Claude (Opus 5.5)
git_commit: fab78587b51ccf6f29a1fbb8bbffd2912b977566
branch: staging
repository: wykonczymy
topic: 'EX-885 — „Pozostało": suma bez ujemnych wierszy, ujemne komórki na czerwono'
tags: [research, kosztorys, column-totals, settlement-rows, grid, worker-view]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: EX-885 — „Pozostało" totals skip negative rows, negative cells red

## Research Question

EX-885: the „Pozostało netto (względem przedmiaru)" section footer and „Razem" sum every row, negatives
included. A negative row is work executed beyond the offer (typically „Prace dodatkowe" with no
Przedmiar → −wykonane), and it hides how much of the offer is still to do. Wanted:

1. The totals sum only rows with Pozostało > 0 — netto, brutto and the worker's plane.
2. A negative Pozostało cell renders red.
3. The `rowRemainingForView` rationale is rewritten; the row value itself stays negative.
4. `column-totals.test.ts` is rewritten for the new rule.

## Summary

- **One summation path.** Every on-screen Pozostało total comes from `columnTotalsForRows`
  (`src/lib/kosztorys/column-totals.ts:57-70`). Nothing else sums `rowRemainingForView` /
  `rowRemainingForExecutedQty`. Clipping per row in that loop covers netto, brutto
  (`toGross(remaining)`, `:78`) and `remainingForPlane` (`:67-69`) in one place. „Σ footers = Razem"
  still holds, because the clip is per row and stays additive.
- **The totals appear on every surface that renders the grid:**
  - the owner's editor
  - the client share page `/k/[token]`
  - the investor preview
  - the worker page
- **No printout carries a Pozostało total.** The offer PDF totals only `plannedNet`; the worker PDF
  totals only `plannedNetForPlane`. Both print Pozostało per row only. EX-885's claim that the worker
  print picks the change up "automatically" is wrong; there is nothing there to pick up.
- **Decision (2026-09-28): no red on printouts.** Red applies only in the grid; see `change.md`.
- **Red cell:** a per-row `tone` already exists on `computedColumn`, with `'danger'` rendering
  `text-destructive`. `donePercent` uses it at `kosztorys-v2-columns.tsx:309`. No money cell in the
  grid uses red-for-negative yet.
- **What this reverses:** the current rule is **EX-686** (`7f586e0f`, 2026-08-13, the inv. 31 incident).
  EX-885 reverses it deliberately. No owner ruling on negative Pozostało or on red is recorded anywhere
  else. The earlier EX-495 („kwota z minusem czy procent") was parked and no longer exists in Linear.
- **Collision:** `2026-09-28-kosztorys-worker-view` (EX-875) has **uncommitted edits in the same
  files**: `kosztorys-v2-columns.tsx`, `header-tips.ts`, `column-config.ts` and `offer-print/*`.
  Start implementing only after that work is committed.

## Detailed Findings

### Totals — `columnTotalsForRows`

- Loop `column-totals.ts:57-70`: `remaining += rowRemainingForView(row, stages, 'client')` (`:66`) and
  `remainingForPlane += rowRemainingForExecutedQty(row, executedQtyByItem[row.id] ?? 0, view)`
  (`:68`). The change is `Math.max(0, …)`, or an equivalent guard, on both.
- `remainingGross = toGross(remaining, vatRate)` (`:78`) is derived from the netto sum, so it inherits
  the clip with no separate change.
- Docblock `:18-40`, and in particular `:26-27`: "a column whose total is not a sum of its own cells →
  leave it out of the map". The new total is a _clipped_ sum of its cells, so the docblock needs an
  explicit exception with its reason: the total reads „ile oferty zostało do zrobienia"; overrun is
  visible per row, in red.
- Consumers:

  | Consumer        | Location                                                                                                 | Reads `remaining*`?            |
  | --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
  | „Razem"         | `use-kosztorys-editor.ts:648-651` → `kosztorys-editor-body.tsx:260` → `kosztorys-synthetic-rows.tsx:131` | yes                            |
  | Section footers | `use-kosztorys-editor.ts:652-661` → `kosztorys-editor-body.tsx:239-244` → `section-footer-cell.tsx:46`   | yes                            |
  | Offer print     | `offer-print-action.tsx:45-51`                                                                           | no — `plannedNet` only         |
  | Worker print    | `build-worker-print-html.ts:56-63`                                                                       | no — `plannedNetForPlane` only |

- Footer and „Razem" cells take no tone: `TotalsRowCell` receives an already formatted string, and
  `SectionFooterCell` is a plain div. Under the new rule a total can never be negative, so that is
  irrelevant.

### Row figures — `settlement-rows.ts`

- `rowRemainingForView` (`:58-64`) = `netForQtyForView(plannedQty ?? 0) − rowValueForView`. **This does
  not change**: the row stays negative. Only the comment `:45-57` changes. Today it argues for counting
  the row into the sum; after the change it should say:
  - the row is still −wykonane, because an offer of zero is not an absent answer;
  - the **total** skips such rows, because it reads „ile oferty zostało";
  - overrun is signalled per row, in red;
  - the old reason, with the inv. 31 example, is the reversed decision (EX-686 → EX-885).
- `rowRemainingForExecutedQty` (`:72-78`), the worker plane: the row figure does not change either.
- Other per-row uses:
  - grid cells `kosztorys-v2-columns.tsx:353-370`
  - sort `sort-value.ts:124-127`
  - printouts `offer-print/columns.ts:245-254` and `worker-columns.ts:77-81`

  None of them sums.

- **Different figures with the same name — do not touch:**
  - „Pozostało do zapłaty" (`acceptance-protocol/settlement.ts`)
  - „Pozostało do wypłaty" (worker summary, `subcontractor-summary.ts`)
  - „pozostało do rozliczenia" (`sheet-compare-dialog.tsx`)

### Red cell in the grid

- API: `computedColumn(id, title, compute, style, format)`, `computed-cell.tsx:57-81`. `style.tone` is
  `'muted' | 'danger' | (row) => …`. `'danger'` → `text-destructive` (`read-only-cell-text.tsx:33`)
  and it overrides muted, so it stays red in the preview too (`globals.css:563-565`).
- `computed-cell.tsx:22-23`: a `danger` tone "tells the user something is wrong but not what", so it
  should come with a `tip`. The etap-with-no-rozliczenie precedent at `kosztorys-v2-columns.tsx:260`
  has one.
- Candidates are the three columns `remaining`, `remainingGross` (`:353-360`) and `remainingForPlane`
  (`:363-370`), each with `tone: (r) => value < 0 ? 'danger' : 'muted'`.
- Red outside the grid already exists as precedent: `subcontractor-worker-totals.tsx:43-54` and
  `margin-actual-table.tsx:123`.

### Overlap with the existing red and with „Problemy"

- `hasStagesOverPlanned` (`settlement-rows.ts:80-99`, `87da5320`) reddens `% wykonania` only when
  Σ etapów > Przedmiar > 0. A no-Przedmiar row is left out deliberately: "reddening a dash says
  przekroczono over a figure that isn't there". Instead it goes to „Problemy" as
  `work-without-planned-qty` (`row-conditions/registry.ts:459-471`, EX-706/707).
- **No contradiction:** that ruling is about a red „—". A negative Pozostało is a number, which is a
  readable cause. Two consequences follow:
  - On a row with a Przedmiar, the red `%` and the red Pozostało appear **together** (a duplicate
    signal in two columns).
  - On a no-Przedmiar row, Pozostało is red while the `%` beside it shows a neutral „—".

  The issue asks for this deliberately.

- **Float noise:** the red check is on value < 0 with no tolerance, so something like 0.1 + 0.2 − 0.3
  gives a red „−0,00 zł". The sum's `> 0` check has the same exposure, though the effect there is in
  the thousandths of a grosz. `QTY_TOLERANCE = 0.005` (`settlement-rows.ts:105`) is on the quantity
  axis, not on złoty.

### Tests

- **Break** (`src/__tests__/lib/kosztorys/column-totals.test.ts`):
  - `:96`: `rowThreeOnly.remaining` = `-30` → `0`
  - `:97`: `sectionB.remaining` = `60 − 30` → `60`
  - `:125`: `worker.remainingForPlane` = `36` → `48` (row 3's −12 drops out; row 4 = 4 × 12)
  - `:88-91`: the test name and comment assert the opposite rule
- **Still pass:**
  - `:77-86` (Σ footers = Razem)
  - `:107` (w_tools equals client)
  - `:156` (empty set)
  - per-row `kosztorys-v2-rows.test.ts:268-288`, which stays negative
  - the printouts, sort, column-set specs and E2E (`kosztorys-grid-writes.spec.ts:80-99` checks
    positive cells only)
- New tests:
  - the section-footer case from the issue (a section with a no-Przedmiar row → the sum without it)
  - brutto consistent with netto
  - worker plane
  - tone: a DOM spec or a unit test on the tone predicate, if it is extracted as a function

## Code References

- `src/lib/kosztorys/column-totals.ts:18-40` — docblock (rule "not a sum of its own cells → blank")
- `src/lib/kosztorys/column-totals.ts:57-70` — the one summation loop (`remaining`, `remainingForPlane`)
- `src/lib/kosztorys/column-totals.ts:77-79` — `remaining`, `remainingGross`, `remainingForPlane` in the map
- `src/lib/kosztorys/settlement-rows.ts:45-64` — `rowRemainingForView` + comment to rewrite
- `src/lib/kosztorys/settlement-rows.ts:72-78` — `rowRemainingForExecutedQty`
- `src/lib/kosztorys/settlement-rows.ts:80-99` — `hasStagesOverPlanned` (the existing red)
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:301-314` — `donePercent` with `tone`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:353-370` — Pozostało columns
- `src/components/kosztorys/editor/grid/cells/computed-cell.tsx:15,22-23,34-54,57-81` — tone / tip
- `src/components/ui/datasheet-grid/read-only-cell-text.tsx:25,33` — `danger` → `text-destructive`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:648-661` — `columnTotals` / `sectionColumnTotals`
- `src/components/kosztorys/editor/grid/kosztorys-synthetic-rows.tsx:48-59,131-136` — „Razem"
- `src/components/kosztorys/editor/grid/section-footer-cell.tsx:46-55` — section footer
- `src/__tests__/lib/kosztorys/column-totals.test.ts:88-98,125` — assertions to rewrite

## Architecture Insights

- Footer and „Razem" are one function at two scopes (EX-607). A change in one place is enough, and the
  Σ-footers = Razem invariant survives any per-row filter.
- Brutto totals are `toGross` of the netto total with a single `vatRate`, not a sum of brutto cells.
  The clip on netto therefore carries through to brutto for free.
- Row tone is a column property (`computedColumn` style), not a cell-renderer property. Adding red is
  one line per column plus a tip; no cell primitive changes.

## Historical Context (from prior changes)

| Date           | Commit                  | What                                                                                                                                                                             |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-16     | `1f0d93e4` (EX-489)     | Pozostało anchored on Przedmiar. A no-Przedmiar row = `null` („—"). A deliberate break from the sheet's AF, which is identically zero.                                           |
| 2026-07-19     | `7ef1d22d`              | Pozostało in „Razem"; no-Przedmiar rows skipped.                                                                                                                                 |
| 2026-07-27     | `e613b0c1` (EX-607)     | `columnTotalsForRows` = footer + „Razem".                                                                                                                                        |
| **2026-08-13** | **`7f586e0f` (EX-686)** | `null` → `plannedQty ?? 0`, so the row reads −wykonane and counts in the sum. Reason: inv. 31 (+64 311 zł „left" at 23 602 zł over the offer). **This is what EX-885 reverses.** |

- `context/archive/2026-07-15-kosztorys-stages-source-of-truth/change.md:20,58,67-80` records the anchor
  on S and the parked EX-495 („minus zostaje na razie").
- `context/archive/2026-07-27-kosztorys-section-footer-row/change.md:25-28`: „Pozostało" as a plain sum
  of its own column. The archive stays as it is; the rule moves into the living docs.
- `context/changes/2026-09-28-kosztorys-worker-view/design.md:37` (#9): the worker's Pozostało spans
  every etap, and a pozycja another crew finished shows 0. Nothing is recorded about negatives or the
  total. Design #6 („Nadpłata, nie liczba ujemna") is about the payout summary, not this column.

## Docs to update in the same change

Several of these are already wrong before the change.

- `context/reference/kosztorys-editor-domain-notes.md`:
  - `:106` "1:1 … `rowRemainingForView` = `AF`" — already wrong; parity is deliberately broken.
  - `:404-406` "przy pustym Przedmiarze „—"" — stale since EX-686. **This is where the new rule goes:**
    the row can be negative and shows red; the sum takes only > 0.
  - `:374-375` (worker view) — add the sum rule.
  - `:415-416` (red `% wykonania`) — add the second red signal.
- `context/reference/kosztorys-sheet/formula-anomalies.md:43-44` "liczy się na minus" — the row still
  reads minus, but no longer lowers the sum.
- `context/foundation/roadmap.md:48` "`rowRemainingForView` exactly = AF" — already stale.
- `context/domain/01-domain-distillation.md:115-116` — add the sum rule to the invariant.
- Header tip `header-tips.ts:13,34` "Na minusie = przekroczono przedmiar." — still true; optionally
  add „suma pomija wiersze na minusie".

## Related Research

- `context/archive/2026-07-15-kosztorys-stages-source-of-truth/` — Pozostało anchored on Przedmiar
- `context/changes/2026-09-28-kosztorys-worker-view/design.md` — the worker's Pozostało (#9)

## Open Questions

1. **Tooltip on a red cell.** `computed-cell.tsx:22-23` requires a `tip` next to `danger`. Proposal:
   „Wykonano więcej niż przedmiar — nie wliczane do sumy". This needs a decision on wording only.
2. **Tolerance.** Proposal: red and exclusion only below −0.005 zł (half a grosz), so float noise does
   not produce a red „−0,00 zł". A złoty-axis tolerance does not exist yet; `QTY_TOLERANCE` is on the
   quantity axis.
3. **Red on the worker's `remainingForPlane`.** The issue covers the worker's sum explicitly, and red
   there presumably follows by symmetry. Confirm that a worker should see red on a pozycja they did
   beyond the przedmiar.
4. **Test-plan anchor.** No risk in `test-plan.md` names column or footer totals. The closest is #1
   ("Two app surfaces disagree"). Either anchor on #1, or extend the plan with `/10x-test-plan`.
5. **Sequencing.** Wait for the EX-875 (worker view) commit, which has uncommitted edits in
   `kosztorys-v2-columns.tsx`, `header-tips.ts` and `column-config.ts`.
6. **Inv. 139 example.** It cannot be reproduced on the local DB: the −800 row is missing, and the
   section sums to 7950. Prod-only; verify after a `db:import` or on staging.
