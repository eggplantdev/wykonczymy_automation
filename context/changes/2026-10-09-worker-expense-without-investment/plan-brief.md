# Worker flag — expense draft without an investment — Plan Brief

> Full plan: `context/changes/2026-10-09-worker-expense-without-investment/plan.md`
> Research: `context/changes/2026-10-09-worker-expense-without-investment/research.md`

## What & Why

Some workers buy things for the company that belong to no investment. A new per-worker flag,
„Może dodawać wydatki bez inwestycji", lets such a worker send an expense draft (photos of a faktura
or paragon) from his own `/pracownicy/[id]` with „Bez inwestycji" picked. Management books it as
„Inny wydatek".

## Starting Point

Every draft layer requires an investment:

- the DB column is `NOT NULL`;
- the action validates stage membership;
- the DAL uses inner joins;
- the dialog has no „none" option;
- the quick-actions button needs ≥1 investment.

Acceptance as `OTHER` (kasa, per-row category, optional per-row buyer) already exists from EX-1027.

## Desired End State

**Manager:**

- ticks the flag in „Edytuj pracownika" and sees it on the worker page;
- accepts the draft and gets „Inny wydatek" prefilled with the kasa and the worker as each row's
  buyer.

**Flagged worker:**

- sees „Bez inwestycji" in the select, auto-picked when he is on no investment;
- has the button even with zero investments.

**Server:**

- refuses a no-investment send from anyone unflagged;
- lets an existing „Bez inwestycji" draft stay as it is after the flag is cleared.

## Key Decisions Made

| Decision                       | Choice                                                                                                   | Why                                                              | Source          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------- |
| How management books it        | „Inny wydatek" (`OTHER`), worker prefilled as buyer per row, category manual                             | `OTHER` already models a company expense with no investment      | Research        |
| Picking „none"                 | Explicit „Bez inwestycji" option, offered only to flagged workers; auto-picked when it's the only option | No silent default; matches the sole-investment auto-pick         | Research        |
| Button gate                    | kasa AND (investment OR flag)                                                                            | Flagged workers with zero investments exist                      | Research        |
| Who sets the flag              | Any management role, checkbox in „Dodaj / Edytuj pracownika"                                             | Worker actions are already management-only                       | Research        |
| Flag change vs existing drafts | No effect; an update keeps a null draft null, never clears a real investment without the flag            | The server gates only a new choice                               | Research + Plan |
| Flag source on the server      | Fresh DB read, never the JWT                                                                             | Tokens live 90 days and don't carry the field                    | Plan            |
| Queue filter                   | Column only, no „Bez inwestycji" filter option                                                           | No sentinel id through URL / `queueFiltersWhere` for a rare need | Plan            |
| Flag visibility                | Edit dialog + manager-only info row on the worker page                                                   | Visible at a glance without widening the listing                 | Plan            |

## Scope

**In scope:**

- migration (user column + nullable draft investment);
- the users field, worker form and reference data (cache v8);
- the worker-page info row;
- DAL null-safety and action enforcement;
- dialog option and quick-actions gate;
- worker table and queue column;
- the acceptance prefill;
- i18n in pl/uk/ru;
- DB + DOM + unit specs.

**Out of scope:**

- a queue filter option;
- a listing column;
- AI category prefill;
- any change to the transfer write path, sheet sync or the duplicate finder;
- E2E.

## Architecture / Approach

Bottom-up:

1. **Schema.** `worker_expense_drafts.investment_id` becomes nullable, and `users` gets a boolean flag.
2. **DAL.** `LEFT JOIN`s, plus trash and pending predicates that pass a null investment.
3. **Action.** `investmentId: number | null`. On null it reads the flag live (`worker-gate.ts`). On
   update without the flag it accepts only a draft that already has none.
4. **UI.** A `'none'` sentinel in the Radix select maps to `null`.
5. **Acceptance.** A null investment switches the prefill to `OTHER`, with `lineItems[].worker` set.

## Phases at a Glance

| Phase                    | What it delivers                                                            | Key risk                                                                  |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Schema + the flag     | Migration, checkbox in worker dialogs, `WorkerRefT` v8, info row            | Forgetting the cache-key bump → stale reference data without the field    |
| 2. DAL + enforcement     | Null drafts listed/counted; send/update gated by a live flag read; DB specs | An inner join left behind silently hides null drafts                      |
| 3. Worker UI             | „Bez inwestycji" option, auto-pick, new button gate, worker table null-safe | Edit of a null draft by an unflagged worker must still offer the option   |
| 4. Management acceptance | `OTHER` prefill with per-row buyer, null-safe reject and column             | The per-row vs top-level `worker` mix-up (top-level is PAYOUT/BONUS only) |

**Prerequisites:** local dev DB on 5433 and the test DB on 5435; `git status src/migrations` is clean
before migrating.

**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- **Prod migration.** It must be applied before deploy (additive). A human runs `pnpm db:migrate:prod`.
- **`down` is lossy.** The migration's `down` deletes no-investment drafts.
- **Action field forwarding.** This assumes `createWorkerAction` / `updateWorkerAction` forward schema
  fields wholesale. If they whitelist, Phase 1 adds the field there.

## Success Criteria (Summary)

- A flagged worker with no investment sends a photo from his phone, and it appears as „Bez
  inwestycji".
- A manager accepts it as „Inny wydatek" with the worker as buyer.
- An unflagged worker cannot create a no-investment draft by any route, including a crafted request.
