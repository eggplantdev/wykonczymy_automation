# Frame Brief: Per-stage value columns + a netto/brutto shortcut

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

Two observations, stated together by the owner on 2026-07-15:

1. The grid renders one column per stage — a qty input. The reference sheet renders two axes:
   `D–M` etap **ilość** and `V–AE` etap **wartość** (plus `AF` pozostało). The wartość half does
   not exist in the app. "Wpisujemy ilość, a potrzebujemy, żeby to było przeliczone na kwotę,
   dokładnie tak samo jak w arkuszu."
2. "I read netto when settling with a subcontractor and brutto when invoicing the client. The two
   never matter in the same sitting — one axis is always dead weight."

## Initial Framing (preserved)

- **User's stated cause or approach**: the two pieces share a netto/brutto classification axis
  across the whole grid, and "that same axis is what forces piece 1's three-group picker split.
  Building them apart means tagging the columns twice" — therefore they must ship together.
- **User's proposed direction**: surface stage value netto+brutto per stage (mirror header, sheet
  order, before `Pozostało`); split `STAGES_COLUMN_GROUP` into three picker groups; add a shortcut
  that bulk-hides every netto or every brutto column. Amended mid-frame: the shortcut is a
  **multiselect** — `netto | brutto | both`, with `both` reachable.
- **Pre-dispatch narrowing** (Step 1.5, owner's own answers):
  - Leading pain = **"Brakuje wartości etapu"** — piece 1 alone. The grid width is tolerable; the
    shortcut "came up while talking".
  - Shortcut driver = **"Zależy od zadania"** — task-dependent reading, _not_ width/noise.
  - **"Tak, nadal wpisuję ceny"** — prices are still typed while reading brutto figures.

## Dimension Map

1. **Visibility / picker layer** — the axis is a property of which columns are on screen; bulk-hide
   is the right operation. ← initial framing
2. **Task / audience axis** — "netto for subcontractor, brutto for client" is a _view_, and the
   editor already has a per-investment view axis (`usePriceView`: client / w_tools / own_tools).
3. **Money display mode** — netto/brutto is a property of how each money figure is _rendered_, not
   of which columns exist. The pain may be the duplication itself.
4. **Coupling premise** — "the pieces share an axis, so they must ship together." Load-bearing for
   the entire change shape.

## Hypothesis Investigation

| Hypothesis                                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verdict                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **1. Visibility layer is the right home**                          | The literal spec cannot be built: `priceGross` is `disabled: true` (`kosztorys-v2-columns.tsx:192,545`); `price` is the only editable price cell. "Hide all netto" hides the cell the owner types into — contradicted by their own Step 1.5 answer (c). `priceCoeff`/`priceMode` are price inputs on _neither_ axis and would survive the hide, leaving an incoherent half-state.                                                                                                                                                                                                                                                                   | **NONE** (as literally specified)                        |
| **2. Brutto is a function of the price view**                      | Structurally false: VAT never enters `calc.ts` (one comment, `:8`); it is a flat render multiplier on a view-aware net. Docs lean client-only (`domain-notes:199`, `plan-brief.md:33`, `roadmap.md:270-271`) and P8 sat open. **Killed by the owner in Step 4**: they _do_ read subcontractor brutto at the investment's rate. The axis is genuinely independent of the view.                                                                                                                                                                                                                                                                       | **NONE** (falsified by owner)                            |
| **3. Netto/brutto is a render mode over one set of money columns** | Brutto has **zero existence outside 10 column definitions** — not in `KosztorysV2RowT`, not in calc, not serialized (`serialize-kosztorys.ts:23`, `snapshot-format.ts:18`), not in the DB (only `investments.vat_rate`), not tested. All 5 pairs are adjacent, same source expression + `* (1 + r.vatRate)`. Exactly 5 netto / 5 brutto, perfect bijection. `fmt` (`:194`) is already the chokepoint for 9 of 10. Write-transform precedent exists **three times** (`subcontractorPriceColumn:369-380`, `subcontractorCoeffColumn:326-335`, `DiscountValueCell:219-231`) — the codebase already abandons `floatColumn` when a write must transform. | **STRONG**                                               |
| **4. The pieces must ship together**                               | Inverted. `toggleKey` (`:625-627`) is a 1-line prefix test with an identity default — all 10 money columns are already their own toggle keys with zero tagging. The three-group split touches **only stage ids**. "Tagging twice" costs **~0 lines**: piece 1 writes ~8 (2 constants, 2 labels, 2 prefix tests), piece 2 writes ~14 (the axis map), nothing overlaps. Intersection = **two string constants** (`STAGE_NET_COLUMN_GROUP` / `STAGE_GROSS_COLUMN_GROUP`), which piece 1 _introduces_ and piece 2 _consumes_.                                                                                                                           | **NONE** — it is a one-way dependency, not a shared axis |

## Narrowing Signals

- **"Tak, nadal wpisuję ceny"** — decisive. It rules out the visibility framing outright: the mode
  the owner asked for cannot exist as a hide operation, because it hides their own input cell.
- **"Brakuje wartości etapu"** — piece 1 is the felt pain; the shortcut is conversational spillover.
  Removes the urgency that justified bundling.
- **"Zależy od zadania"** — the shortcut is not a width hack, so "piece 1 makes the grid too wide"
  is not its rationale. This dissolves the circularity research flagged (Open Question 2): piece 1
  justified brutto stage columns with _"piece 2 makes the width objection moot"_ (`change.md:40`)
  while piece 2's value rested on hiding piece 1's new columns.
- **"Tak, czytam brutto podwykonawcy"** — **answers P8** (`domain-notes:298`), open since the notes
  were written. VAT applies across all three views at the investment's rate. Shipped behaviour
  (`plan.md:232`) is correct; `plan-brief.md:33`'s "client-decision figure" prose is the loose one.
- **"No per view toggle"** (owner, 2026-07-15) — the netto/brutto axis is **global**, one setting
  across all three views, following the existing picker map (`table-columns:kosztorys`, global by
  design: "a preferred column set is a property of the person reading"). Per-view memory was raised
  and **rejected**. So the view↔axis correlation the owner reported ("netto for subcontractor,
  brutto for client") is real but stays **unmodelled** — the axis is set by hand, not predicted.
  Do not reintroduce per-view defaulting in piece 2's plan without a new decision.

## Cross-System Convention

The project's own convention is **compute, never store** (`calc.ts` header): only inputs persist,
every money figure derives live. Brutto already obeys it — but was then materialized _as columns
anyway_, which is the inconsistency. In the client view, **5 of 17 data columns are pure
`× (1 + vatRate)` restatements — ~30% of the grid is a formatting decision rendered as structure.**
`STAGES_COLUMN_GROUP` (`constants.ts:53`) is the precedent for one picker entry covering many
columns; it exists because per-stage entries were noise. The same argument applies here one level up.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: netto/brutto is a _display axis over money figures_
> (`netto | brutto | both`), not a visibility state over columns — and it was materialized as five
> duplicated column pairs, which is what makes "one axis is always dead weight" a structural
> problem rather than a picker preference. Separately and independently, the stage axis is missing
> its value half.

Brutto is `fmt(net × 1.08)` and nothing else — no field, no row key, no storage, no sort key, no
test. Pairing it into the column list is what created the dead weight; hiding half the pairs is a
control for a distinction that should never have been structural. The owner's `both` multiselect
is the tell: three states (`netto` / `brutto` / `both`) is a _mode_, not a toggle. Under a mode,
`Cena j.m.` stays a single editable cell rendering the active axis — which is the only reading that
survives "I still type prices", and the write-transform precedent for it already exists three times
over.

The two pieces are **independent**. Piece 1 is the felt pain, is sheet-parity work whose math
already exists (`stageValueForView`, `calc.ts:77`, the sheet's `V` verbatim), and needs no decision
from piece 2. Piece 2 depends on piece 1 only for two string constants.

## Confidence

**HIGH.**

- Strong evidence, four independent investigations, one of them run blind (no hypothesis named) that
  converged on the same structural finding.
- The reframe survived an honest attempt to break it: the _stronger_ version of it — "brutto is a
  function of the price view, so drop the control entirely" — was falsified by the owner in Step 4
  and is recorded dead above. What remains is the narrower claim that survived.
- The decisive narrowing signal is the owner's own reported behaviour, not an inference.

## What Changes for /10x-plan

**Sequence, don't bundle.** Plan piece 1 alone: per-stage value columns, sheet parity, the felt
pain. The coupling argument that joined them does not survive contact with the code (~0 lines saved
by bundling), and bundling is precisely what made the width circularity unfalsifiable — shipped
apart, it is testable: land piece 1, dogfood it, and see whether the width pain is real before
building a control for it.

Piece 2 is then a separate change, and its plan should start from the **mode** framing, not the
bulk-hide one: `netto | brutto | both` over the 5 money pairs, with `price` inside the mode rather
than exempted from it. Do not treat it as a picker shortcut — that shape is falsified.

Open decisions /10x-plan inherits (from `research.md`): the stage-value id namespace (must **not**
start with `stage_` — `diffRow:91-98` would feed `NaN` into `setStageProgressAction`); sortability
of the new columns; `dropWidth` must now drop 3 keys per stage, not 1.

Newly settled by this frame — record outside this change: **P8 is answered** (VAT applies in all
three views at the investment's rate). `domain-notes:298` should move out of OPEN questions.
`kosztorys-stages/plan.md`'s "no brutto column on stage values" exclusion is reversed by the owner
and that plan is still `in review`.

## References

- Source: `src/lib/tables/kosztorys-v2-columns.tsx:192,194,326-335,369-380,219-231,545,557,585,598,606,625-627`
- Source: `src/lib/kosztorys/calc.ts:8,24,77` · `src/components/kosztorys/use-hidden-columns.ts:47-51`
- Source: `src/components/kosztorys/use-price-view.ts:26,53` · `kosztorys-section-summary.tsx:228-232`
- Research: `context/changes/kosztorys-stage-values/research.md`
- Prior: `context/changes/kosztorys-editor-ux/design.md:107-111` (EX-426 brutto toggle, deleted 2026-07-13)
- Prior: `context/archive/2026-07-10-kosztorys-vat/plan-brief.md:33` vs `plan.md:232` (the contradiction P8 resolves)
- Domain: `context/reference/kosztorys-editor-domain-notes.md:298` (P8 — answered by this frame)
