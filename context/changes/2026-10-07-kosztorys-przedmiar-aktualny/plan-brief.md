# „Aktualizacja przedmiaru” — Plan Brief

> Full plan: `context/changes/2026-10-07-kosztorys-przedmiar-aktualny/plan.md`
> Research: `context/changes/2026-10-07-kosztorys-przedmiar-aktualny/research.md`

## What & Why

Przedmiar is the offer, but the scope keeps moving after it: extra works, dropped works and changed
quantities agreed with the client. Progress and „what is left” must be measured against that moving
scope, while the offer stays what the client received. The fix is a second quantity per pozycja,
„Aktualizacja przedmiaru”, beside „Przedmiar ofertowy”.

## Starting Point

One field, `plannedQty`, does two jobs: the offer and the progress denominator. Nothing on the
transactions plane reads it, so the change is contained in the kosztorys plane. That covers the
editor, the investor document, worker surfaces, filters, history and import.

## Desired End State

- The editor shows ofertowy and aktualizacja side by side, each with its value. An unedited
  aktualizacja is grey and follows ofertowy. A hand edit is black, and Delete restores following.
- % wykonania, Pozostało and the overrun signal follow the aktualizacja.
- The investor sees a pure offer until the first etap entry, then both przedmiary.
- Workers see only the aktualizacja.

## Key Decisions Made

| Decision            | Choice                                                                                                                    | Why (1 sentence)                                                              | Source           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| Names               | „Przedmiar ofertowy” / „Aktualizacja przedmiaru” / „Wartość netto aktualizacji przedmiaru”                                | Owner's wording, one name on every surface                                    | Owner            |
| Copy timing         | Follows ofertowy until edited by hand (AI statuses included)                                                              | The offer can still change before scope drifts                                | Research → owner |
| Storage             | Only the hand edit is stored (nullable); unedited = ofertowy                                                              | Follow, re-import survival and AI statuses work with no backfill or sync code | Plan             |
| Progress anchor     | % wykonania, Pozostało, overrun, section completion, filters → aktualizacja                                               | Work is measured against the agreed scope                                     | Owner            |
| Stays ofertowy      | Prognoza marży, section pie, „Oferta”, AI review, sheet comparison                                                        | „Otherwise it is not a forecast”                                              | Owner / Plan     |
| Investor doc        | Pure offer before the first etap entry (no aktualizacja, no Pozostało); after it, aktualizacja ticked, its value unticked | Folds in `offer-hides-remaining`, same trigger                                | Owner            |
| Worker surfaces     | Aktualizacja only, same label, uk/ru translated                                                                           | The crew works to current scope                                               | Owner            |
| Worker-report extra | Ofertowy 0, aktualizacja = reported qty                                                                                   | Scope grew after the offer                                                    | Owner            |
| Re-import           | Sheet refreshes ofertowy; hand-edited aktualizacja survives                                                               | Sheet has one przedmiar, which is the offer                                   | Owner            |
| Cell look           | Grey = follows, black = edited, Delete = follow, 0 = out of scope                                                         | Mirrors the subcontractor „auto” price                                        | Owner            |

## Scope

**In scope:**

- the column, its migration and every tree writer;
- the calculation move;
- the editor columns and rename;
- the investor document rule;
- worker surfaces;
- history;
- filters and usage checks;
- glossary and domain notes.

**Out of scope:**

- transactions-plane figures;
- writing to the owner's sheet;
- bulk set actions;
- an „oferta wysłana” freeze;
- renaming the `plannedQty` identifier;
- EX-495.

## Architecture / Approach

- A nullable `current_planned_qty` column, and one resolver (`stored ?? ofertowy`) that every
  progress reader calls.
- The existing per-field autosave, undo and snapshot machinery carries the new key unchanged.
- The investor document gets its own „hidden until the first entry” list, because the worker
  document shares the current one.

## Phases at a Glance

| Phase                     | What it delivers                                          | Key risk                                                    |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Data model and writers | Column persists and round-trips through every writer      | A missed writer silently drops a hand edit                  |
| 2. Calculation layer      | Progress figures read the aktualizacja                    | Tautological tests if fixtures keep ofertowy = aktualizacja |
| 3. Editor columns         | Two new columns, rename, grey/black cell, footer, history | Delete committing 0 instead of „follow”                     |
| 4. Investor document      | Pure offer → both przedmiary after the first entry        | Hiding aktualizacja on the worker doc by sharing the list   |
| 5. Worker surfaces        | Aktualizacja everywhere the crew looks                    | Stored „hide Przedmiar” choice silently lost                |
| 6. Docs and archive       | Glossary, domain notes, archive the folded change         | —                                                           |

**Prerequisites:** local docker DB on 5433, test DB on 5435.
**Estimated effort:** ~3 sessions across 6 phases.

## Open Risks & Assumptions

- Prod migration is additive and must run (human) before the push.
- The rabat on the aktualizacja value follows the ofertowy rule. EX-495 is still open for both.

## Success Criteria (Summary)

- The manager types 120 over an offered 100, and % wykonania / Pozostało move. The offer, the
  prognoza and the investor's pre-work document don't.
- A worker never sees the offer quantity, only the agreed scope.
- A sheet re-import never erases a scope change made in the app.
