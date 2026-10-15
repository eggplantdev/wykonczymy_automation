# Investment status „Odrzucona” + active-only booking pickers — Plan Brief

> Full plan: `context/changes/2026-10-15-investment-status-rejected/plan.md`
> Research: `context/changes/2026-10-15-investment-status-rejected/research.md`

## What & Why

A client who declines at Wycena / Planowana leaves the investment with no fitting status — „Zakończona”
means finished work. New status „Odrzucona” (`rejected`). While here, the booking forms' investment
pickers offer only Aktywne and Planowane investments: money on a Wycena is a convenience miss, not a
risk, so it is solved by hiding, not by a server lock (owner, 2026-10-15). Whether Wycena is hidden is
still an open owner decision (EX-1066, parked) — it gates Phase 2 only.

## Starting Point

Statuses derive from one tuple; adding one is a migration + label + badge colour. The booking pickers
hide non-active investments only by default — a „Wszystkie” checkbox and the URL prefill from
`/inwestycje/[id]` both let a Wycena through. The server refuses only Zakończona and the trash.

## Desired End State

„Odrzucona” is selectable, badged, hidden by default and dimmed in the list, and skipped by the nightly
snapshot run. Wpłata, wydatek and edycja przelewu list only Aktywne and Planowane investments (plus
the one a transfer already holds), with no checkbox to widen the list. Nothing on the server changes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Name | „Odrzucona” / `rejected` | Owner rejected „Rezygnacja”. | Plan conversation |
| List filter | Hidden by default | Like Zakończona; no `INHERITED_FLAG` needed. | Owner |
| Leaving the status | Free for every role | The owner-only exit guard belongs to Zakończona alone. | Owner |
| Booking on non-active | Hide in pickers, no server lock | Wycena / Planowana / Odrzucona carry no money; the risk is nil. | Research follow-up |
| `isBookableInvestment` | Unchanged (completed-only) | The transfers table reads it for edit/cancel; narrowing it is the declined lock. | Research |
| Planowana in booking forms | Stays offered | Money is already booked on planned investments in practice. | Owner, 2026-10-15 |
| Wycena in booking forms | Hidden — **pending owner decision** | One entry in `BOOKING_PICKER_STATUSES` reverses it. | Open (EX-1066) |
| Picker mechanism | `BOOKING_PICKER_STATUSES` + opt-in fixed-filter prop on `EntityComboboxField` | The ref's `active` flag can't hold Planowana without leaking into other pickers; the held investment is kept as in `activeOrSelected`. | Plan |
| Row dim + nightly snapshots | Dim; exclude from daily snapshots | A declined offer reads and behaves as closed; history kept. | Plan (stated default) |

## Scope

**In scope:** enum migration; tuple / label / pickable list / badge; default-hidden + dim; daily
snapshot exclusion; forced active-only picker in three booking forms; URL prefill rule; spec rows;
lesson + domain-notes update.

**Out of scope:** any server-side refusal; kosztorys lock; worker share link; snapshot retention;
fixing Agatha 208 / Żubrowa 177 data.

## Architecture / Approach

Status: one tuple entry fans out to schema, form, filter; two type-forced maps; one hand-written
`ALTER TYPE … ADD VALUE`. Pickers: `BOOKING_PICKER_STATUSES` (active, planowana) with
`isOfferedForBooking`; `EntityComboboxField` gains a fixed-filter prop that keeps the selection and
drops `ActiveFilterLabel`; `useInvestmentFromUrl` seeds only offered investments.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Status „Odrzucona” | Enum, constants, badge, dim, snapshot exclusion, spec rows | Migration suffix collision with a parallel session |
| 2. Booking pickers | Aktywne + Planowane pickers, URL seed rule, status-set + URL-seed specs | Blocked on the Wycena decision; edit form must keep the held investment |
| 3. Docs | Lesson update, domain-notes sentence | — |

**Prerequisites:** local docker DB (5433) and `db-test` (5435) up.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Prod migration must run (human, `pnpm db:migrate:prod`) before the push; revert needs a data `UPDATE`.
- A form draft restored with a non-active investment keeps it (EX-643 rule) — accepted.

## Success Criteria (Summary)

- A Wycena can be marked Odrzucona and disappears from the default list.
- No booking form lets the user pick an investment outside Aktywna / Planowana.
- Existing transfers on Wycena investments stay editable and cancellable.
