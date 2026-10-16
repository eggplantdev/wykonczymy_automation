# Rabat amount on przedmiar — Plan Brief

> Full plan: `context/changes/2026-10-16-offer-planned-discount-amount/plan.md`

## What & Why

An offer with a rabat shows the investor the rabat % and a „Wartość przedmiaru netto" that is already
discounted — but never the rabat in złoty, and the header doesn't say „po rabacie". The existing
„Rabat kwota netto" is the rabat on pomiar (executed work), so in the offer phase it is always empty
and hidden.

## Starting Point

„Wartość przedmiaru netto" = przedmiar × cena − rabat (sheet column S). „Rabat kwota netto" rides on
Σ etapów and sits among the settlement columns, hidden until an etap has an entry. Every rabat column
in the investor document is hidden by default and ticked per investment in „Opcje".

## Desired End State

The editor offers „Rabat kwota netto (przedmiar)" and its brutto twin. The investor „Opcje" offer the
netto one under „Ceny i rabat" (unticked by default); ticked, it shows on the share link, podgląd and
PDF whenever some pozycja has a rabat. With a rabat present, the przedmiar value headers read
„… — po rabacie" everywhere.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Existing „Rabat kwota netto" | Unchanged (rabat on pomiar) | One column, one meaning |
| Default in investor document | Hidden, like other rabat columns | Existing investments where rabat was hidden on purpose stay hidden |
| Brutto twin | Editor only | Editor's netto/brutto mode needs a pair; investor doc has no brutto columns |
| „— po rabacie" suffix | Everywhere, only when some pozycja has a rabat | One name per column; conditional so offers without rabat don't read as discounted (b921b9476) |
| Suffixed columns | Przedmiar + aktualizacja przedmiaru, netto/brutto | All four are post-rabat offer values; „Wartość netto (razem etapy)" keeps its own rabat column |
| Empty rule | Hidden in investor doc when no pozycja has a rabat | Same predicate as the suffix — they can't disagree |

## Scope

**In scope:** new value + totals, predicate, conditional label, editor grid/picker, „Opcje" group,
share/podgląd, PDF, header tip.

**Out of scope:** `discountAmount` meaning, `net` label, brutto in investor doc, global-rabat amount on
przedmiar, DB/migration, sheet sync.

## Architecture / Approach

One value in `computedColumnValues` (feeds grid, footer and PDF), one predicate
`hasPlannedDiscount(rows)` (feeds the empty rule and the label), one optional `hasDiscount` flag on
`columnLabelForView` (feeds grid headers, picker and PDF).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lib, test-first | Value, totals, predicate, conditional label, config sets | Suffix leaking onto `net` or crew planes |
| 2. Wiring | Editor, „Opcje", share/podgląd, PDF | New key accidentally default-visible → rabat disclosed on existing investments |

**Prerequisites:** none.
**Estimated effort:** one session, two phases.

## Open Risks & Assumptions

- Assumes the owner wants the plain name (no suffix) in the „Opcje" checklist — it is a setting
  label, not a header.

## Success Criteria (Summary)

- An offer with a rabat can show the rabat in złoty per pozycja and in total.
- The investor can tell the przedmiar value is after rabat; an offer without rabat looks as today.
