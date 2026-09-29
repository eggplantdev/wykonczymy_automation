---
change_id: strata-obniza-bilans
title: A loss lowers the client's debt like a discount, while staying a separate reporting figure
linear: EX-675
status: archived
created: 2026-08-12
updated: 2026-08-13
archived_at: 2026-08-13T11:04:22Z
branch: konradantonik/ex-675-strata-obniza-dlug-klienta-jak-rabat-pozostajac-osobna
worktree: .claude/worktrees/ex-675-strata
---

## Notes

`LOSS` gets the same arithmetic as `RABAT` — ↓ margin, ↑ balance — while staying a separately
summed figure, because the owner wants to report "how much have I lost". Investment becomes required
(`requiresInvestment('LOSS') → true`): prod carried 6 LOSS rows (3 live, 3 cancelled) and **every
one already had an investment**, so no backfill was owed.

**The owner already stated the intent in the data.** The three live losses:

| id   | amount | inv. | description                     |
| ---- | ------ | ---- | ------------------------------- |
| 3298 | 362,84 | 62   | „naprawa połogi kolejny raz"    |
| 3737 | 39,00  | 98   | „brak skasowania za to klienta" |
| 4470 | 142,65 | 47   | „strata źle zamówione coś tam"  |

3737's description ("the client wasn't charged for it") _is_ this change's premise in the owner's
own words. He had also migrated his own workarounds onto the right types — cancelled
`OTHER_DEPOSIT` 1381 (142,65, inv. 47) reappears as live LOSS 4470, while cancelled `OTHER_DEPOSIT`
1171 (132,87, inv. 18) reappears as live `RABAT` 4467. He picked a loss in one case and a discount
in the other, so the loss-vs-discount distinction is his, not ours to invent.

**The defect this closes.** Investment 62: two `INVESTMENT_EXPENSE` rows (222,88 + 139,96 = 362,84,
`settled = false`) plus a `LOSS` of 362,84, labor 0, deposits 0. Margin read −362,84 (correct — the
company ate the cost) but balance read −362,84 too, i.e. the client still owed it. A loss did half its
job: it ate the margin and left the debt standing. Regression fixture: that exact shape → balance 0,
margin −362,84.

**Why not the existing `settled` checkbox.** „Wliczone w robociznę" (counted into labor) on the
expense produces the same two numbers, but its label is false when labor is 0, and it cannot express
a loss with no cash expense behind it (a penalty, downtime, waived labor). A loss is the more general
tool and the one the owner reached for. Accepted consequence: two routes to one outcome — ticking the
checkbox _and_ adding a loss for the same amount swings the balance to +362,84, which the code cannot
detect (two independent rows).

**VAT plane — settled with the owner (2026-08-12): face value, one rule, no flag.** A loss may cover
a cash expense _or_ waived labor, which sit on different VAT planes (materials carry none, work
carries 23%). The owner's ruling is to ignore that split rather than model it: **the amount entered is
the amount the client stops paying, identically net and gross.** No 23% is ever added to or stripped
from a loss. So a loss deducts at face value, like a deposit — _not_ pre-VAT like a discount, despite
"works like a discount" being the origin of this change. The analogy holds for the direction and stops
at the VAT plane. The one thing to tell the owner: on waived labor he enters the figure he wants taken
off the client's bill — if he is thinking gross, he types gross.

**Plumbing.** A loss stays a transfer — the sheet has no loss column — so it rides alongside materials
and deposits, outside `SummaryReadingT` (labor + discount, both kosztorys-sourced) and outside the
v1↔v2 reconciliation. v2 does not go through `calculateBalance`, so it needs its own explicit
deduction step in the settlement; the discount reaches v2 by being baked into the kosztorys, a loss
cannot.
