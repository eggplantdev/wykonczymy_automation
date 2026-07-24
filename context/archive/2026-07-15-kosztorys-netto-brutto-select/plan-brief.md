# Netto / brutto / both select — Plan Brief

> Full plan: `context/changes/kosztorys-netto-brutto-select/plan.md`
> Frame brief (parent change): `context/changes/kosztorys-stage-values/frame.md` — read the
> **SUPERSEDED** note at `:124-129`, not the paragraph above it
> Research (parent change): `context/changes/kosztorys-stage-values/research.md`

## What & Why

The owner reads netto when settling with a subcontractor and brutto when invoicing the client, and the
two never matter in the same sitting — one axis is always dead weight on screen. This adds a
`Netto | Brutto | Oba` control to the editor toolbar that narrows which money columns render. It is
"piece 2", split out of `kosztorys-stage-values` by `/10x-frame`; piece 1 (the per-stage value
columns) has shipped.

## Starting Point

The grid already decides column visibility on **one line** — `buildV2Columns`' filter over
`toggleKey(col.id)` (`kosztorys-v2-columns.tsx:694-699`) — and `toggleKey` already collapses the
per-stage namespace into three static group ids. Brutto exists **only** as column definitions: no row
field, no DB column, no serialization — every brutto figure is `netto × (1 + vatRate)` computed at
render. So there is nothing to migrate and nothing to write; the change is entirely about what is on
screen.

## Desired End State

The toolbar carries a second reading axis beside the price-view toggle. `Netto` drops the six brutto
columns; `Brutto` drops the five non-exempt netto ones; `Oba` restores whatever the picker allows.
`Cena j.m. netto` never leaves the screen. The choice persists across reloads and applies to all three
price views.

## Key Decisions Made

| Decision                            | Choice                                                        | Why (1 sentence)                                                                                                                                | Source                     |
| ----------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `price` vs the mode                 | **Exempt** — always visible                                   | It is the only editable money cell; exempting it deletes the write-transform, the VAT round-trip, and the rounding question in one move.        | Frame (owner, superseding) |
| Picker vs select                    | **AND-composition** — `visible = pickerAllows AND axisAllows` | They answer different questions ("never show this" vs "show which side"), so they cannot disagree; `DEFAULT_HIDDEN_COLUMNS` survives unchanged. | Frame (owner)              |
| Scope of the setting                | **Global**, one across all three price views                  | A reading preference belongs to the person reading, matching the existing picker map; per-view memory was raised and rejected.                  | Frame (owner)              |
| Footer (`Suma netto`/`Suma brutto`) | **Untouched** — always both                                   | The select is about the grid; the summary is a summary, not a view. Removes `calc.ts` and the summary component from the plan entirely.         | Plan                       |
| Picker menu appearance              | **Unchanged** — an axis-hidden column still reads as checked  | Keeps the picker answering only its own question; zero code in the picker layer.                                                                | Plan                       |
| Control form                        | **`ToggleGroup`** beside the price-view group                 | Same primitive, same place as the grid's other reading axis.                                                                                    | Plan                       |
| Untagged columns                    | **Fail-open** (neutral by default)                            | A forgotten tag then shows a column rather than vanishing one.                                                                                  | Plan                       |

## Scope

**In scope:** an axis tag per money column (keyed by `toggleKey`, in `constants.ts`); a `MoneyAxisT`

- `axisAllows` predicate; a global localStorage hook; a second predicate on the existing filter line;
  a toolbar `ToggleGroup` with a Polish tooltip legend.

**Out of scope:** the column picker; the Sekcje footer and `sectionSubtotalsForView`; `price`;
per-view memory; any write-transform or VAT arithmetic; migrations; a remount `key` (that is EX-422's
flicker).

## Architecture / Approach

One orthogonal predicate on the line that already owns visibility:

    assembleV2Columns(opts)            // the single registry of what exists — untouched
      .filter(c => !isHidden(key(c))   // the picker's answer — untouched
                && axisAllows(key(c))) // ← this change

`useMoneyAxis` (localStorage, `useSyncExternalStore`) feeds `moneyAxis` into `columnOpts`;
`COLUMN_MONEY_AXIS` is 12 static entries keyed by `toggleKey`, so no stage id ever enters the map —
preserving the ghost-id property the three picker groups were built for.

## Phases at a Glance

| Phase                  | What it delivers                                          | Key risk                                                                                     |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. The axis as a model | Tag map, `axisAllows`, storage hook, the filter predicate | An axis tag keyed by column id instead of `toggleKey` would silently miss every stage column |
| 2. The toolbar control | `ToggleGroup` + prop threading + Polish legend            | Reaching for a remount `key` when the column set changes — EX-422's flicker                  |

**Prerequisites:** `kosztorys-stage-values` — for **two string constants only** (the stage
picker-group ids), already on the branch.
**Estimated effort:** one session; no DB, no server actions, no migration.

## Open Risks & Assumptions

- **The select only narrows; it never guarantees.** Picker-hidden `Brutto` + mode `Brutto` shows
  nothing. Correct by the model, but it may read as a broken control — a dogfooding check, not code.
- `kosztorys-stage-values` is still **in review** with 14 unticked manual checks; this change builds on
  its column factory. Nothing here depends on those checks passing, but a reversal there would ripple.
- **Census correction:** the shaping recorded "6 netto / 6 brutto / 9 neutral of 21". `COLUMN_LABELS`
  actually holds **22** keys — the split is 6 / 6 / **10**. The 12 tagged columns (11 moved) are
  unaffected.

## Success Criteria (Summary)

- Picking `Netto` or `Brutto` removes the other axis's columns from the grid, and `Cena j.m. netto`
  survives both.
- The setting holds across reloads and across all three price views.
- The column picker and the Sekcje footer behave exactly as they do today, in every mode.
