# Per-stage value columns (netto + brutto) — Plan Brief

> Full plan: `context/changes/kosztorys-stage-values/plan.md`
> Frame brief: `context/changes/kosztorys-stage-values/frame.md`
> Research: `context/changes/kosztorys-stage-values/research.md`

## What & Why

You type a quantity into a stage column and nothing tells you what it's worth. The reference sheet
has both halves — `D–M` etap **ilość** and `V–AE` etap **wartość** — and the app only has the first.
This surfaces the second.

The frame settled the shape: the netto/brutto **shortcut** originally bundled with this is split out,
because the coupling argument saved ~0 lines and made the width objection circular (piece 1 justified
brutto stage columns with "piece 2 makes the width moot", while piece 2's value rested on hiding
piece 1's columns). Shipped apart, that's testable.

## Starting Point

The math already exists and is already tested. `stageValueForView` (`calc.ts:77`) is the sheet's
`V = D5*$Q5-(D5*$Q5*$R5)` verbatim, covered across all three price views plus a percent discount
(`kosztorys-calc.test.ts:37-47`) — but it's only ever called internally to feed `Pozostało`, never
surfaced as a column. Brutto has no existence outside column definitions: no row field, no calc
function, no DB column, just `× (1 + vatRate)` at render. So this is presentation work on a tested
core — the same shape as `c468ec6` (Rabat kwota netto/brutto), which touched three files and nothing
else.

## Desired End State

Each stage carries three columns instead of one: the editable qty, then `Etap N — netto` and
`Etap N — brutto` at the far right before `Pozostało`, with read-only headers that mirror the stage's
name. Rename a stage and all three headers follow; delete it and all three columns go. The picker's
single `Etapy` entry becomes three, and `Etapy — kwota brutto` starts off.

## Key Decisions Made

| Decision                                        | Choice                                                      | Why (1 sentence)                                                                                                        | Source   |
| ----------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Ship piece 2 (netto/brutto shortcut) with this? | No — split out                                              | Coupling saved ~0 lines; bundling made the width argument unfalsifiable.                                                | Frame    |
| Column order                                    | Qty after `J.m.`, value block at the end before `Pozostało` | Owner's call, verified against the live sheet.                                                                          | Frame    |
| Netto **and** brutto per stage                  | Both                                                        | Every other money figure carries a pair; a stage without brutto would be the lone exception.                            | Frame    |
| P8 — does VAT apply to subcontractor prices?    | Yes, all three views at the investment's rate               | Owner reads subcontractor brutto; settles a question open since the domain notes were written.                          | Frame    |
| Header text                                     | `Etap 1 — netto` / `— brutto`                               | Three columns share one stage name; a literal sheet mirror would render three identical headers.                        | Plan     |
| Default visibility                              | Kwota netto on, kwota brutto off                            | Halves the new width while delivering the figure asked for.                                                             | Plan     |
| How to default-hide without seeding             | Invariant shifts `absent = visible` → `absent = default`    | Seeding would freeze the default into every user's localStorage and make it indistinguishable from a deliberate choice. | Plan     |
| Sortable?                                       | No — plain label                                            | Matches the qty stage columns, and `title(...)` would inherit the no-op-sort bug (dead arrow, no effect).               | Plan     |
| Zero-qty cell                                   | `0,00`                                                      | Consistent with all five existing computed pairs; a blank cell is ambiguous.                                            | Plan     |
| Column id namespace                             | `stageValueNet_<id>` / `stageValueGross_<id>`               | Must not start with `stage_` — that prefix is load-bearing in both the picker and the save path.                        | Research |

## Scope

**In scope:** two computed columns per stage; grid reorder; three picker groups; brutto off by
default; `dropWidth` for the two new ids; doc reconciliation (P8, S-03's reversed exclusion, roadmap).

**Out of scope:** the netto/brutto shortcut; the no-op sort on 7 computed columns (pre-existing);
orphan width entries across tabs (pre-existing); summaries and the footer; "suma etapu" (roadmap 12b);
any sortability of the new columns.

## Architecture / Approach

`assembleV2Columns` (`kosztorys-v2-columns.tsx:496-620`) is the one list both the grid and the picker
read — that's what stops them drifting. This adds two `stages.map(...)` groups of `computedColumn`s to
it and re-orders the array. `computedColumn` receives the whole row, so the value is derived at render
from the qty already sitting there — **nothing new is stored**.

That's not a style preference. `diffRow` (`v2-rows.ts:91-98`) classifies every key on the row object
by the `stage_` prefix alone, with no allowlist — so a stage-value _row field_ would parse
`Number('value_7')` → `NaN` and fire a save against a nonexistent stage. Computed columns never touch
the row object, and the id namespace deliberately dodges the prefix, making that structural rather
than incidental.

## Phases at a Glance

| Phase                            | What it delivers                                                            | Key risk                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Stage value columns + reorder | The feature: 2 columns/stage, owner's order, 3 picker groups, width cleanup | Stage delete must take all three columns and drop all three width entries; the wrong-stage-rename class lives next door |
| 2. Default-hidden columns        | `absent = default` invariant; brutto group off by default                   | Changes the meaning of an absent key for existing users — must not silently reveal or hide anything they chose          |
| 3. Doc reconciliation            | P8 answered; S-03's reversed exclusion + stale dsg claim annotated; roadmap | Low — prose only                                                                                                        |

**Prerequisites:** local dev DB (`docker compose up -d`) and a seeded investment
(`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`). No migration, no prod step.

**Estimated effort:** ~1 session. Phase 1 is the bulk; phases 2–3 are small.

## Open Risks & Assumptions

- **The width cost ships unmitigated, by design.** At 10 stages the client view carries ~47 columns.
  The frame found the pre-emptive mitigation (piece 2) circular, so dogfooding decides whether the
  pain is real. Phase 2's default takes ~10 columns off the initial render.
- **The index-identity trap is next door.** `stage-header.tsx:24`'s `key={stage.id}` exists because
  dsg keys header cells by column index and the qty label is an uncontrolled input. The new value
  headers are read-only text and can't hit it — but this change alters stage column count and
  positions, which is exactly the input to that trap. Its fix was reasoned from source and **never
  reproduced by hand**; manual step 6 is the first real test of it.
- **Never add a remount `key`** to force the column change through (`lessons.md:119-135`) — the
  remount _was_ the EX-422 flicker.
- **No new automated tests.** The calc is covered and the delta is wiring, so the manual pass carries
  the signal. A test re-asserting `stageValueForView(...) * 1.08` would test arithmetic, not this
  change.

## Success Criteria (Summary)

- Typing a qty into a stage shows its value in PLN, and `Pozostało netto` drops by the same amount —
  the reference sheet's behaviour, in the app.
- Renaming a stage moves all three headers; deleting it takes all three columns and leaves no orphan
  width entry behind.
- The grid opens with kwota netto visible and kwota brutto hidden, and each of the three `Etapy`
  picker groups hides independently and persists.
