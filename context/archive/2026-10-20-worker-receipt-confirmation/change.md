---
change_id: worker-receipt-confirmation
title: Worker confirms money booked into his own kasa, like a wypłata
status: archived
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20T14:40:41Z
branch: worker-receipt-confirmation
worktree: ../wykonczymy-worktrees/worker-receipt-confirmation
---

## Notes

Extend the wypłata confirmation flow (pending → accepted/rejected, push, badge, management
notification) to every booking that puts money into a kasa owned by an EMPLOYEE: Transfer między
kasami (target kasa), Inna wpłata, Wpłata od inwestora, Zasilenie z konta firmowego (source kasa).

Scope (user, 2026-10-20): every way a worker can receive money through the UI. All four are bookable
today — the „Wpłata” dialog's Kasa picker lists worker kasy, and a transfer's target kasa can be a
worker's. Prod counts at 2026-10-20: 157 transfers into worker kasy, 20 zasilenia (19 on launch day
2026-03-11), 2 inne wpłaty, 1 wpłata od inwestora (#5730, 400 zł gotówką, Glogera 6/5). Every one
was booked by management, never the worker. Premia is out: it moves no cash, its money arrives as a
wypłata.

A „worker's kasa” is any kasa whose owner is an EMPLOYEE — 21 `WORKER` and 8 `AUXILIARY` kasy.

User, 2026-10-20: „zaliczka na zakupy się pojawia jako info od managera” — a transfer into a worker's
kasa is a zaliczka na zakupy, and the worker sees it as a message from the manager who booked it.
„ale to musi być transfer między kasami” — a zaliczka na zakupy is booked as a Transfer między kasami
(manager's kasa → worker's kasa), never as a wpłata.

Deposits are in scope (user, 2026-10-20): „If there are transfers like this and they are used, then it
means they can happen and will happen, and we need to cover this as well.” An Inna wpłata, Wpłata od
inwestora or Zasilenie booked into a worker's kasa asks him to confirm, like a transfer.

Trigger (user, 2026-10-20): „Any transfer to a kasa owned by an employee should trigger a
notification and should be confirmed.” — not a list of types and not „booked by management”.

Korekta is out (user, 2026-10-20): it raises the kasa balance, but it's a refund on an expense the
worker already reported, not money handed to him. The rule is „money handed to the worker”: a
Transfer między kasami into his kasa, or any wpłata booked into it.

Cards stay as they are (user, 2026-10-20): same card as a wypłata (inwestycja or „Bez inwestycji”,
kwota, opis), no „od managera” line.

No „wypłata” anywhere in the flow's copy (user, 2026-10-20): one neutral wording for every kind, a
wypłata included — headings, dialogs, toasts, push, badge, the management table, in pl/uk/ru.
Approved Polish copy (uk/ru follow it):

| Where                   | Copy                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Worker's list heading   | Do potwierdzenia                                                                                           |
| Rejected list heading   | Odrzucone                                                                                                  |
| Rejected list hint      | Czekają na wyjaśnienie z kierownikiem. Nadal możesz je potwierdzić albo poczekać, aż kierownik je anuluje. |
| Confirm dialog          | Potwierdzasz odbiór?                                                                                       |
| Confirm toast           | Odbiór potwierdzony                                                                                        |
| Reject dialog           | Odrzucasz {{amount}}                                                                                       |
| Reject toast            | Odrzucono                                                                                                  |
| Already decided         | To zostało już rozpatrzone albo anulowane — odśwież stronę.                                                |
| Push title              | Pieniądze do potwierdzenia                                                                                 |
| Push body               | Potwierdź odbiór {{amount}}. (unchanged)                                                                   |
| Management table on „/” | Odrzucone przez pracowników                                                                                |
| Management hint         | Trzeba je wyjaśnić z pracownikiem lub anulować.                                                            |

Status labels („Czeka na potwierdzenie”, „Potwierdzona”, „Odrzucona”, „Anulowana”) stay — they agree
with „transakcja”. „Wypłata” the type and „Pozostało do wypłaty” are a different thing and stay.

Rename (user, 2026-10-20): the confirmation flow's code (built 2026-10-11 — `components/payouts/`,
`payout-confirmation` db/actions/queries/constants, `notify-pending-payouts`, `pending-payouts`, its
i18n keys, the `rejectedPayouts` nav stream) moves to „receipt” names, in its own phase. Stays: the
PAYOUT type, „Rozlicz wypłaty”, „Pozostało do wypłaty” and the payout-pair figures, and everything
persisted — the `payout_*` columns, the Payload field names, the push tag.

My calls (planning, 2026-10-20): a transfer between two kasy of the same employee asks nothing (no
handover; 0 so far); a transfer from one worker's kasa to another's is confirmed by the receiver.

## Design (kept at archive)

- **The recipient is derived, not stored.** The worker for a wypłata, the receiving kasa's owner
  otherwise (`RECIPIENT` in `lib/db/receipt-confirmation.ts`: `target_register_id` for a Transfer
  między kasami, `source_register_id` for a wpłata — the balance rule). Stable because a used kasa's
  owner is locked and its registers/amount can't be edited. Reusing `worker_id` was rejected: it
  would leak the worker into the „Pracownik" column, the `?worker=` filter and the sheet's
  „Pracownik" cell for a Wpłata od inwestora.
- **The owner's role is read once, at create** (the stamp). An EMPLOYEE later promoted keeps his
  pending items; a deactivated (not trashed) worker's kasa still gets a stamp — the status gates
  nothing, so both are accepted. Kasa „Andrii Elektryk" is OWNER-owned and asks nobody.
- **Persisted names stay „payout"**: `payout_*` columns and enum, the Payload fields, the push tag
  `payout-pending`, the `rejected-payouts*` storage keys, and symbols named after the field
  (`carriesPayoutStatus`, `PayoutStatusBadge`). A column rename needs a migration for no gain.
- **Deploy order:** the CHECK migration only relaxes (additive) — `pnpm db:migrate:prod` before the
  push, or every booking of the new kinds fails on the old CHECK.
- **Open with the owner:** any MANAGER may „Anuluj" any rejected receipt, an OWNER's „Zasilenie z
  konta firmowego" included (`canCancelTransfer`, carried over from wypłaty); the „Odrzucono" column
  header isn't in the approved copy table.
- **Untested in a browser:** no E2E covers confirm/reject for a transfer or wpłata — EX-1121.
