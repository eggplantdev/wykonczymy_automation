# Work/Progress Column Toggle — Plan Brief

> Full plan: `context/changes/kosztorys-layer-toggle/plan.md`

## What & Why

Add a fourth reading-axis toggle — **Praca / Postęp / Bez filtra** — to the kosztorys v2 editor, so the
owner can collapse the table to just the offer/work columns or just the progress-tracker columns. Today
the tracker columns (per-stage kwoty, % wykonania, Pozostało) are always mixed in with the working
columns; there's no one-click way to read only one layer.

## Starting Point

The editor already has three composable reading axes built from one repeated pattern (money netto/brutto,
progress kwoty/%, and the column picker), all converging in a single filter predicate in `buildV2Columns`
and threaded through `useKosztorysEditor`. The new axis is a fourth instance of that exact pattern.

## Desired End State

A segmented toggle after the Etapy toggle. **Bez filtra** (default) shows everything. **Praca** hides the
progress tracker. **Postęp** hides the work columns but keeps the always-visible context (Sekcja, Opis
prac, Pomiar). Columns are assigned to a layer by identity in a map, so the choice persists, composes with
the other axes, and survives column reordering or new columns.

## Key Decisions Made

| Decision                 | Choice                                                                        | Why                                                                            | Source |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Targeting mechanism      | Identity map (`COLUMN_LAYER`), not index                                      | Reorder-/new-column-safe; matches existing axes                                | Plan   |
| Progress columns         | `stageValueNet/Gross/Percent`, `donePercent`, `remaining` (+`remainingGross`) | Owner's "everything after Netto is the tracker"                                | Frame  |
| Pomiar (`stageQtySum`)   | Neutral — always visible                                                      | Owner ruling: shows in every mode                                              | Frame  |
| Default axis             | `both` (Bez filtra)                                                           | Mirrors the money axis default                                                 | Plan   |
| 3-state from 1-sided tag | `LAYER_NEUTRAL_COLUMNS` allowlist                                             | Only progress is tagged, so "Postęp" needs a neutral set to hide untagged work | Plan   |
| Labels / placement       | Praca / Postęp / Bez filtra; append after Etapy                               | Consistent with neighbouring money toggle                                      | Plan   |

## Scope

**In scope:** `COLUMN_LAYER` + neutral allowlist, `layer.ts` (`layerAllows`), filter wiring, unit test,
`use-layer.ts` localStorage hook, toolbar options + toggle, editor-hook wiring.

**Out of scope:** any figure/calculation change, `KosztorysProgressCounter`, column reordering, per-kosztorys
persistence, new picker entries, schema/migration.

## Architecture / Approach

Clone the money-axis stack (type+default+predicate, column map, localStorage hook, toolbar option, editor
wiring, test). One deviation: only progress columns are tagged, so `layerAllows` consults a small
`LAYER_NEUTRAL_COLUMNS` allowlist (Sekcja, Opis prac, Pomiar) to keep context visible and treat every other
untagged column as "work." The predicate composes as `picker AND money AND progress AND layer`.

## Phases at a Glance

| Phase                          | What it delivers                               | Key risk                                             |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| 1. Layer axis logic (headless) | Map + `layer.ts` + filter wiring + unit test   | Getting the 3-bucket-from-1-tag semantics right      |
| 2. UI toggle + editor wiring   | localStorage hook, toolbar toggle, hook wiring | Toolbar/context wiring parity with the other toggles |

**Prerequisites:** none — self-contained clone of an existing pattern.
**Estimated effort:** ~1 session, 2 short phases.

## Open Risks & Assumptions

- The neutral allowlist (Sekcja, Opis prac, Pomiar) is a judgment call — if the owner wants more context
  always-visible in "Postęp" (e.g. J.m., Cena), it's a one-line addition to `LAYER_NEUTRAL_COLUMNS`.
- Assumes etapy-ilość inputs belong to "work" (hidden in Postęp), per the owner's framing that the input
  lives with the work and the tracker is the amounts on the right.

## Success Criteria (Summary)

- One click collapses the table to work-only or progress-only, with context always readable.
- The choice persists across reloads and never contradicts the other three toggles.
- A new column added later needs no toggle change — neutral until tagged.
