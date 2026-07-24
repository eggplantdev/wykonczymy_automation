---
change_id: netto-expense-type
title: Netto investment-expense type (spike)
status: planned
created: 2026-07-24
updated: 2026-07-24
archived_at: null
---

## Notes

Spike added to the EX-536 zaliczka-v2 PR. A new transfer type `INVESTMENT_EXPENSE_NET` carries a
second stored `netAmount`: the expense leaves the register at brutto (`amount`) but bills the investor
at netto (`netAmount`, immutable, `netAmount ≤ amount`). Design + resolved decisions:
`design.md`. Plan: `plan.md` / `plan-brief.md`. Guards B1–B5 + B7. Kosztorys/spike data is throwaway.
