# „% wykonania (względem przedmiaru ofertowego)” — Plan Brief

> Full plan: `context/changes/2026-10-09-done-percent-vs-offer/plan.md`

## What & Why

Since EX-921, „% wykonania” is measured against the Aktualizacja przedmiaru. The owner also wants to
see how much of the **offer** is done, so a second percentage column is added against the Przedmiar
ofertowy.

## Starting Point

`% wykonania` is one entry in the column-value resolver. That entry feeds the cell, the sort, the
totals and the print. The rest of the wiring is lists:

- layer
- settlement hiding
- investor allowlist and order
- print

## Desired End State

The editor shows both percentages side by side. On the new one:

- a pozycja outside the offer is blank;
- work grown past the offer reads above 100%, without the red tint.

On the investor document it is an available tick, unticked everywhere. „Widok pracownika” gets two
unticked ticks, „Przedmiar ofertowy” and the new percentage, so the managers decide.

## Key Decisions Made

| Decision            | Choice                                   | Why                                                                                                                           |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Existing column     | Unchanged, id and label kept             | Renaming means rewriting stored hidden sets for no visible gain.                                                              |
| New id              | `plannedDonePercent`                     | Follows the `plannedNet` / `currentPlannedNet` pair.                                                                          |
| Tint above 100%     | None (`muted`)                           | Past the offer is normal once the scope was updated. Red stays the existing column's „past the agreed scope” signal.          |
| Ofertowy 0          | Blank                                    | A worker-report extra has no offer to be a percentage of.                                                                     |
| Editor              | Visible by default, „Postęp” layer       | The owner asked for it. It belongs with its neighbour.                                                                        |
| Investor document   | Available tick, unticked, plus migration | A stored set is the HIDDEN set, so without the migration it would appear on every saved investor link.                        |
| Worker document     | Ofertowy + new % as unticked ticks       | Managers decide (2026-10-09). The worker's % counts all etapy of the pozycja, like his „Pozostało”, so it matches the editor. |
| Legacy `plannedQty` | Mapping retired, migration rewrites      | `plannedQty` becomes a live worker key. The prod row holds no legacy key.                                                     |
| Totals              | None                                     | A ratio has no honest sum, the same as its neighbour.                                                                         |

## Scope

**In scope:**

- the calc helper and resolver entry
- label, tip and layer
- the grid column
- settlement hiding
- the investor allowlist, order, print and data migration
- worker ticks (ofertowy + new %), translations, worker print, data migration
- specs

**Out of scope:**

- any change to the existing „% wykonania” or to Pozostało
- worker ticks for the existing „% wykonania” or the ofertowy's value
- totals

## Phases at a Glance

| Phase                     | What it delivers                       | Key risk                                                                                        |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Figure + editor column | The column in the kosztorys editor     | Wrong divisor. The spec pins both percentages on one row.                                       |
| 2. Investor-document tick | Optional tick on podgląd, link and PDF | Leaking onto saved investor links. The migration plus the default spec cover it.                |
| 3. Worker-document ticks  | Ofertowy + new % in „Widok pracownika” | Migration order: deploy first. Migrating first would hide the aktualizacja on worker documents. |

**Prerequisites:** none. Both migrations run locally; on prod a human applies them. Phase 3's migration runs after its deploy.
**Estimated effort:** under one session.

## Open Risks & Assumptions

- „Tam” in the owner's request is read as the editor. The investor tick is offered but unticked. If
  the owner wants it on every investor document by default, that is a one-line change to
  `DEFAULT_VISIBLE_COLUMNS` and the migration is dropped.
- No red tint is a judgement call. If the owner wants above 100% of the offer flagged, it becomes a
  tone predicate mirroring `hasStagesOverPlanned` against the ofertowy.

## Success Criteria (Summary)

- Both percentages agree with Pomiar / Przedmiar ofertowy and Pomiar / Aktualizacja on every row.
- A pozycja outside the offer is blank.
- No saved investor link gains a column.
