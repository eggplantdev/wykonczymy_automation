# Rabat kwotowy — linked netto/brutto fields — Plan Brief

> Full plan: `context/changes/2026-09-29-global-rabat-on-settlement-axis/plan.md`
> Research: `context/changes/2026-09-29-global-rabat-on-settlement-axis/research.md`
> Linear: EX-933 (Urgent)

## What & Why

On a brutto-settled investment the owner types a rabat kwotowy of 5000 meaning 5000 zł off the bill.
The app takes 5400 off, because the field accepts only netto and the brutto column adds VAT on top.
The owner must be able to type the kwota on whichever axis they think in.

## Starting Point

One „zł" input stores a netto kwota. Every surface reads that netto and grosses it where it shows
brutto. Saving rounds the kwota to grosze.

## Desired End State

„Kwotowy" shows two linked inputs, netto and brutto. Typing in one fills the other live, and one
„Zapisz" commits. On inv. 112, typing 5000 in brutto yields Rabat −5000,00 in the brutto
Podsumowanie. „Historia zmian" shows both axes.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Model | Two linked inputs, one stored netto | The owner's own proposal. Readers and DB stay untouched. | Research |
| VAT grossing of rabat | Unchanged | A rabat cuts the price of prace; face value would break invoice VAT (400 zł gap on inv. 112). | Research |
| VAT change after entry | Brutto follows the new rate | User: "if you change VAT then obviously it changes". | Research |
| Storage precision | `round6` instead of cents | A brutto entry must re-gross to exactly what was typed. | Plan |
| Commit | Two inputs, one „Zapisz" | Live preview before saving, one commit point as today. | Plan |
| History row | „netto / brutto", each at its version's VAT | The owner recognises the figure they typed. | Plan |
| Per-pozycja kwota rabat | Left as netto | 0 rows in prod. The urgent case is the global rabat. | Plan |

## Scope

**In scope:** storage precision, the linked-pair input + hint copy, the history row, the domain notes
and roadmap.

**Out of scope:**
- the per-pozycja kwota rabat
- any change to readers or the grossing rule
- data fixes (the owner re-types inv. 112)
- unrelated doc drift

## Architecture / Approach

Everything happens before the one stored number. The pair converts brutto → netto (`toNet`) at
commit and stores `round6(netto)`. Readers keep `toGross(netto)`, which returns the typed brutto.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Storage precision | `round6` on write + round-trip spec | Sub-grosz netto showing up raw somewhere (all readers format; verified in research) |
| 2. Linked inputs | New pair field, wiring, hint, DOM spec | Resync on undo/VAT change without `useEffect` |
| 3. History pair | Diff carries VAT; row shows both axes | Existing history specs' expected strings |
| 4. Docs | Domain notes + roadmap | — |

**Prerequisites:** local DB from today's prod dump (inv. 112, 106).
**Estimated effort:** ~1 session.

## Open Risks & Assumptions

- Inv. 112 keeps −5400 until the owner re-types the kwota in brutto. Communicate this at deploy.
- The assumption is that the owner never needs a „which axis was typed" record. Storage is netto
  only, per the user's VAT-change ruling.

## Success Criteria (Summary)

- Typing 5000 in brutto takes exactly 5000,00 off the brutto bill.
- Netto investments behave exactly as before.
- Undo, mode switching and VAT changes keep both inputs truthful.
