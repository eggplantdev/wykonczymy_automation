---
change_id: ex-557-legacy-deposit-types
title: Deposits without an investment — restore OTHER_DEPOSIT and block the investment on OTHER_DEPOSIT / COMPANY_FUNDING
status: archived
created: 2026-08-12
updated: 2026-08-12
archived_at: 2026-08-12T18:18:03Z
branch: konradantonik/ex-557-inna-wplata-zasilenie-bez-inwestycji
worktree: null
---

## Notes

EX-557.

### Owner ruling (2026-08-12) — CORRECTS the earlier EDIT in the issue

The July EDIT in the issue („Inna wpłata — chowamy w formularzach", i.e. hide it in the forms) was
**carried out wrongly**: instead of taking the investment choice away from that type, we took away
the whole type. Commit `72ddc5d7` (2026-07-21) dropped `OTHER_DEPOSIT` from `DEPOSIT_UI_TYPES` a
day after a live row was booked with it (`id=3898`, a cutter deposit, 2026-07-20). The intent was
to remove the **variant with an investment**, not the type. From then on a manager had no way to
book cash entering a register **without** an investment — 8 of 14 `OTHER_DEPOSIT` rows are exactly
such inflows.

Rules in force:

1. **„Inna wpłata" returns to the deposit form** — visible to every role, as before 21.07.
2. **Neither „Inna wpłata" nor „Zasilenie z konta firmowego" ever has an investment choice.**
   Enforced in one place, not only in the add dialog's JSX: the **edit** dialog and the Payload
   panel still showed the investment field, and `hooks/transfers/validate.ts` let it through.
3. **„Zasilenie z konta firmowego" is visible only to ADMIN/OWNER**; „Inna wpłata" has no role limit.
4. **„Wpłata od inwestora" stays the only deposit with an investment** and the only one carrying
   net/gross (EX-536).

The LEGACY marker from the July EDIT **does not apply** — both types are live, just investment-free.

### Rulings after research (2026-08-12)

6. **The role gate on `COMPANY_FUNDING` stays client-only** — owner: „client jest good enough".
   `createTransferAction` is not hardened by role; a knowingly accepted risk (a manager could post
   this type via the API). Do not re-raise.
7. **Stale `vatPlane` on types that don't carry it is cleaned up here.** Same root cause as the
   `investment` leak: hiding a field in JSX doesn't clear its value, and `toData` sends it.

### Consequence of the prod data fix

The owner cancelled the three backfill rows (2026-03-25) that had an `OTHER_DEPOSIT` with an
investment, so no active row of either type carries one. That removed the only reason for a second
write semantics (`ignoresInvestment` — "skip the field" instead of "clear it"). Both types take the
existing `showsInvestment === false → investment = null` path, like `OTHER` / `REGISTER_TRANSFER`;
taking them out of `INVESTMENT_TYPES` carries the whole rule, with no new predicate and no new branch
in `validate.ts`.

Accepted risk: editing one of those three cancelled rows **from the Payload panel or a script** would
clear its `investment_id`. The transfers table can't edit them — a cancelled row has no actions
column. They are cancelled migration junk, outside every sum.
