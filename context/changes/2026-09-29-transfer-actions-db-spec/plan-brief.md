# Transfer actions asserted on persisted state (EX-911) — Plan Brief

> Full plan: `context/changes/2026-09-29-transfer-actions-db-spec/plan.md`
> Research: `context/changes/2026-09-29-transfer-actions-db-spec/research.md`

## What & Why

Test-plan risk #3 is that the core ledger drifts: a transfer stops moving the register balance or the
investment figures correctly. Nothing checks this today. No test books a transfer through the real
create, cancel or update action and then reads the figures back from Postgres. This change adds that
test, and fixes the two actions that can lose their audit row halfway through a write.

## Starting Point

- `transfer-actions.test.ts` mocks Payload entirely, so it never reads anything back.
- Cancel and update each do two writes with no transaction around them.
- Premia (BONUS) arrived after the first plan and has no persisted-state coverage.
- The financials doc gives the wrong formulas for bilans and marża.

## Desired End State

- One DB spec books a ledger of every figure-moving type through the real actions, then asserts
  hand-calculated literals for:
  - the register balances;
  - the investment buckets and bilans;
  - the worker's „Pozostało do wypłaty".
- It covers cancel and edit the same way.
- Cancel and update are atomic, proved by tests that were red first.

## Key Decisions Made

| Decision                          | Choice                                                                                     | Why                                                                            | Source            |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------- |
| Unit-spec slim/move (old Phase 3) | Dropped, left to test-suite-audit                                                          | That agent is pruning the same file in the working tree and has its own layout | Research          |
| BONUS                             | In the ledger; „Pozostało" read back via a kosztorys tree; MANAGER refusal persists 0 rows | The role gate lives only in the action; the pair row needs kosztorys items     | Research          |
| Atomicity                         | Both cancel and update, test-first                                                         | Same non-atomic shape; every newer multi-row writer is already transactional   | Research          |
| Framing of the cancel bug         | Audit row lost, figures stay right                                                         | The second write is the audit row; balances don't depend on it                 | Research          |
| Marża                             | Not asserted                                                                               | Owner 2026-09-29: definition undecided                                         | Plan (2026-09-29) |
| Oracle                            | Hand-written literals with their arithmetic in comments                                    | Test-plan §1: never read the expected value from the code under test           | Plan (2026-09-29) |

## Scope

**In scope:** a new `lib/actions/transfers.db.test.ts`, atomic cancel and update in
`lib/actions/transfers.ts`, and fixes to the formulas in the financials doc and the risk #3 row in the
test plan.

**Out of scope:** pruning or moving the mocked spec, the invoice actions, NET expenses, kosztorys v2
figures, and the update quirks (an omitted description is blanked; a non-robocizna amount is silently
ignored).

## Phases at a Glance

| Phase                     | What it delivers                                                                | Key risk                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. DB spec + create/bulk  | 9-step ledger incl. BONUS; refusals; bulk commit/rollback                       | Fixture cleanup (CANCELLATION / amount_edits rows escape `purgeFixtureUsers`)              |
| 2. Atomic cancel + update | Red-first atomicity tests, then `withPayloadTransaction`; cancel/edit figures   | Mocked spec breaks on the added `req` — touch only those assertions, commit only own hunks |
| 3. Docs                   | Correct bilans/marża formulas, line refs, BONUS in the diagram; risk #3 covered | —                                                                                          |

**Prerequisites:** the db-test container on 5435 with current migrations (`scripts/test-integration.sh`
handles this).
**Estimated effort:** one session.

## Open Risks & Assumptions

- The test-suite-audit agent may still be editing `transfer-actions.test.ts` during Phase 2. If a needed
  assertion fix overlaps one of its hunks, leave that file out and say so.
- This assumes the kosztorys tree helper can produce a stage due for a single worker. The precedent is
  `book-overpayment-bonus.test.ts`.

## Success Criteria (Summary)

- A transfer booked, cancelled or edited through the app's actions provably lands in the right figures.
- A failed audit write can no longer leave a transfer cancelled or re-priced with no audit row.
