---
change_id: zamrozone-brutto-wydatku-netto
title: Zamrożone brutto wydatku netto w „Wydatkach inwestycyjnych" — brutto z faktury, nie z stawki
status: implemented
created: 2026-09-23
updated: 2026-09-23
archived_at: null
branch: zamrozone-brutto-wydatku-netto
worktree: null
---

## Notes

Research: `research.md`.

Owner's request (2026-09-23), on the podsumowanie „Wydatki inwestycyjne" table in kosztorys v2:

- „netto price is frozen — brutto price should be frozen too"
- „if I add different than 8% setting both prices are not affected"

A wydatek netto (`INVESTMENT_EXPENSE_NET`) carries both amounts from the invoice (`amount` =
brutto, `net_amount` = netto). Today only netto is taken as recorded; its brutto is re-derived
from the materiały rate, so changing the rate moves a brutto nobody paid. The one real row in
prod (inv. 146) shows 5477,60 brutto against 4809,60 on the invoice.

This reverses part of the 2026-08-07 decision (`context/archive/2026-07-29-netto-expense-grossup/`),
which weighed only rates as the bridge and never considered the stored `amount`.
