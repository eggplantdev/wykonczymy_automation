# Worker Receipt Confirmation — Plan Brief

> Full plan: `context/changes/2026-10-20-worker-receipt-confirmation/plan.md`
> Research: `context/changes/2026-10-20-worker-receipt-confirmation/research.md`

## What & Why

A worker already confirms or rejects every wypłata. Money also reaches him as a zaliczka (Transfer
między kasami into his kasa) and as wpłaty booked into his kasa — 23 such bookings in the last 30 days,
14 workers — and none of it asks him anything. Same flow, every handover.

## Starting Point

The 2026-10-11 confirmation flow: status columns on `transactions`, the worker's „Do potwierdzenia"
cards, push + badge, „Odrzucone" table on „/". Its back half is generic; PAYOUT and `worker_id` are
hard-coded in the CHECK, the stamp, the ownership WHERE, the rejected table, the push gate and copy.

## Desired End State

A transfer or wpłata into an employee's kasa is born „Czeka na potwierdzenie", pushes him, counts on
his badge, sits on the same card; a rejection shows on „/" with its type. No „wypłata" in the flow's
copy; the code says „receipt".

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Trigger | Transfer into an EMPLOYEE-owned kasa, any wpłata into one | „Any transfer to a kasa owned by an employee" | User |
| Korekta | Out | A refund on his own expense, no handover | User |
| Own two kasy | No confirmation | Nothing changes hands | Plan (my call) |
| Recipient | Derived: worker (wypłata) / receiving kasa's owner | Owner locked on a used kasa; one SQL rule for every query | Research |
| Card | Unchanged | „The cards are fine as they are" | User |
| Copy | Neutral, approved table in `change.md` | „Why do we need wypłaty there at all" | User |
| Naming | Rename the flow's symbols to receipt; persisted names stay | Code no longer lies; persisted renames are risk for nothing | User |
| Management table | One table on „/" + „Typ" | One place to act | Plan (accepted in playback) |

## Scope

**In scope:** CHECK migration, create-time stamp, shared recipient rule, rejected table, push/badge,
copy in pl/uk/ru, worker-page filter, glossary + test-plan.

**Out of scope:** korekta/cancellation/premia, backfill, balances and the sheet, a sender line,
cancel-time push, the wypłata feature itself, persisted renames.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Rename | „receipt" names, no behaviour change | A missed import path (tsc + grep catch it) |
| 2. Stamp | CHECK relaxed, pending on money to an employee | Prod migrate must precede the push |
| 3. Recipient | One ownership rule for decide/list/count/table | A foreign worker deciding — pinned by risk #27 spec |
| 4. Push | Push + badge for every kind | Push only verifiable in production |
| 5. Copy & docs | Neutral texts, filter, glossary, test-plan | uk/ru phrasing |

**Prerequisites:** none; human runs `pnpm db:migrate:prod` before the push.
**Estimated effort:** ~1 session, 5 small phases.

## Open Risks & Assumptions

- An owner promoted from EMPLOYEE keeps his already-pending items (role read only at create) — acceptable.
- Kasa „Andrii Elektryk" is OWNER-owned although an employee uses it — it asks nobody.

## Success Criteria (Summary)

- A worker confirms a zaliczka exactly like a wypłata, push and badge included.
- Management sees every rejection on „/" with its type.
- Nobody but the receiving worker can decide.
