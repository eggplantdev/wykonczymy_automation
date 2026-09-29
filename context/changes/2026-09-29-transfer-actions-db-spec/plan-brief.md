# Transfer actions asserted on persisted state (EX-911) — Plan Brief

> Full plan: `context/changes/2026-09-29-transfer-actions-db-spec/plan.md`
> Research: `context/changes/2026-09-15-test-suite-audit/research.md` §2

## What & Why

Test-plan risk #3 — after a transfer is booked, cancelled or edited, the register balance and the
investment figures are what they should be — has no DB coverage. The biggest spec in the repo covers
these actions against a mocked Payload, never reads anything back, and in places pins shapes that never
persist. This change proves the figures on real Postgres and fixes the one defect the mock was hiding.

## Starting Point

`src/__tests__/transfer-actions.test.ts` (1 195 LOC, 77 `it`, 39 `toHaveBeenCalledWith`). No DB spec
calls create/cancel/update. `cancelTransferAction` writes the cancelled flag and the audit row in two
separate, non-transactional writes.

## Desired End State

A DB spec books a fixed ledger through the real actions and checks register balances, the transactions-
plane buckets and the bilans against hand-computed literals. Cancel is atomic, proven by a test that
was red first. The unit spec sits at its mirror path and holds only refusals and invoice-list logic.

## Key Decisions Made

| Decision                         | Choice                                                                                                           | Why                                                      | Source           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| DB spec scope                    | create / bulk / cancel / update + LABOR_COST edit + locked-investment refusal; no invoice actions                | invoice order is pure logic; media delete reaches Blob   | Plan             |
| Old spec                         | move to `lib/actions/transfers.test.ts`, keep refusals + invoice logic, delete write-shape and impl-detail cases | a mock can prove a refusal, not a write                  | Research + Plan  |
| Oracle                           | hand-written literals per step: register balance, buckets, bilans                                                | never derive the expected value from the code under test | Plan             |
| Marża                            | not asserted; its inputs are                                                                                     | owner: marża differs v1 vs v2 and is undecided           | Owner 2026-09-29 |
| Cancel half-write                | fix now, test-first, `withPayloadTransaction`                                                                    | real defect the mock hid                                 | Plan             |
| Stale formulas in financials doc | fix, record marża as open                                                                                        | doc lifecycle                                            | Plan             |

## Scope

**In scope:** new `transfers.db.test.ts`; atomic cancel; moved + pruned unit spec; financials doc; test-plan risk #3 status.

**Out of scope:** marża figure; invoice/media actions on DB; NET-rate materials discount; v2 figures; other root transfer specs (EX-912/913).

## Architecture / Approach

One fresh investment, two fresh registers, eight transfers booked through the actions (deposit, expense,
correction, robocizna, rabat, strata, wypłata, przesunięcie), figures checked after each step; then two
cancellations, a robocizna edit and a forced audit-row failure. Mocks: `server-only`, `after` no-op,
`requireAuth` with a real user id, revalidate stub. Cleanup by raw SQL on entry and exit.

## Phases at a Glance

| Phase                       | What it delivers                             | Key risk                                 |
| --------------------------- | -------------------------------------------- | ---------------------------------------- |
| 1. DB spec + create/bulk    | figures pinned for every create path         | fixture leak in the shared test DB       |
| 2. Cancel (atomic) + update | red→green atomicity fix, cancel/edit figures | sheet sync must still fire on commit     |
| 3. Slim unit spec           | mirror path, ~−600 LOC                       | deleting a case that was the only guard  |
| 4. Docs                     | correct formulas, marża marked open          | test-plan.md has another session's edits |

**Prerequisites:** 5435 `db-test` up and migrated.
**Estimated effort:** one session.

## Open Risks & Assumptions

- `vi.spyOn(payload, 'create')` reaches the action's Payload because `getPayload` returns the same singleton.
- Once marża is decided, a figure-level assertion should be added to this spec.

## Success Criteria (Summary)

- Break any figure-moving transfer path and a DB test names the wrong figure.
- A failed cancel leaves no half-cancelled transfer.
- The unit spec asserts nothing that a real write would contradict.
