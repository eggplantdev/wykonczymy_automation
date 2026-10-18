# Transfer actions asserted on persisted state (EX-911) Implementation Plan

> Replanned 2026-10-18 from `research.md`. The 2026-09-29 plan predated BONUS, atomic bulk create and
> 22 commits to the transfer code. Its "slim the unit spec" phase has been handed to test-suite-audit.

## Overview

This change closes test-plan risk #3. Each transfer is booked, cancelled or edited through the real
server actions. Afterwards, three things must equal values computed by hand: the register balance and the
investment figures, both read back from Postgres, and the worker's „Pozostało do wypłaty". Along the way
we make `cancelTransferAction` and `updateTransferAction` atomic, with a failing test written first, and
correct the stale formulas in the financials doc.

## Current State Analysis

- **No DB spec calls create, cancel or update.** Only `createBulkTransferAction` runs against a real DB:
  in `lib/actions/payout-without-stages.test.ts` and `lib/actions/worker-expense-drafts.db.test.ts`.
  `src/__tests__/transfer-actions.test.ts` mocks Payload completely. The test-plan rollout row "Lock the
  financial core" says `not started` (`test-plan.md:121`).
- **Two writers are not atomic:**
  - `cancelTransferAction` calls `update(cancelled:true)`, then `create(CANCELLATION)`
    (`transfers.ts:287-304`).
  - `updateTransferAction` calls `update`, then `create('amount-edits')` (`:348-376`).

  In both, a failed second write leaves the figures correct but loses the audit row. Every multi-row
  writer added since September already uses `withPayloadTransaction`.

- **BONUS (EX-979) is uncovered on persisted state.**
  - It needs an investment and a worker.
  - Only ADMIN/OWNER may book it, and that gate exists only in the actions (`transfers.ts:51`, `:147`).
  - It moves no register, no bilans v1 and no marża v1.
  - It raises „Pozostało do wypłaty", but the pair row only exists when the investment has kosztorys items
    (`db/worker-payout-pairs.ts:37-45`).
- **The CANCELLATION row copies `original.amount` as-is.** A cancelled CORRECTION therefore yields a
  negative CANCELLATION amount; the old plan's "+amount" claim was wrong. The FKs are null because the
  hook forces the source register to null and the action never passes target, investment or worker.
- **Marża's definition is open** (owner, 2026-09-29). Its inputs are pinned; the figure is not.

## Desired End State

- `src/__tests__/lib/actions/transfers.db.test.ts` runs every figure-moving type through the real
  actions on the 5435 DB. It asserts, as hand-written literals with their arithmetic in a comment:
  - the register balances;
  - the transactions-plane buckets and bilans v1;
  - the worker's „Pozostało do wypłaty".

  It also covers cancel and update on persisted state, and the refusals that must persist zero rows:
  BONUS as MANAGER, a locked investment, and a failed bulk line.

- Cancel and update each write their pair of rows in one Payload transaction. A DB test proves that a
  failed audit-row write leaves the original row unchanged.
- The financials doc states the formulas the code actually computes, with correct line refs, and lists
  BONUS among the types with no register.

Verify: `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env node_modules/vitest/vitest.mjs run src/__tests__/lib/actions/transfers.db.test.ts`
is green, and the spec is found by integration discovery.

### Key Discoveries:

- **Harness template: `worker-expense-drafts.db.test.ts:12-32, 114-138`.**
  - Mock `next/server` so that `after: () => {}`.
  - Drive `requireAuth` from a `vi.hoisted` `authState` with a mutable `role` (`book-overpayment-bonus.test.ts:19-25`).
  - Mock revalidate via `() => import('@/__tests__/stubs/cache-revalidate')`. Never write a hand-rolled
    factory (`__tests__/AGENTS.md:10-15`).
  - Find the OWNER and an expense category with `payload.find`.
  - Import the action dynamically, after the mocks.
- **Worker + register:** `createRegisterOwner` (`helpers/transfer-fixtures.ts:3`) creates an EMPLOYEE with
  an AUXILIARY register. Call it twice to get registers A and B; owner A doubles as the PAYOUT/BONUS
  worker.
- **„Pozostało" read-back:**
  - Build the tree with `createKosztorysTree` (`helpers/kosztorys-db-tree.ts:46`): one item and one stage
    assigned to the worker, with progress, so `due` > 0.
  - Read the figure with `pairRemaining(db, investmentId, workerId)` (`helpers/pair-remaining.ts:6`).
  - Precedent: `book-overpayment-bonus.test.ts:124-142`.
- **Figures are read through the uncached `lib/db` functions:**
  - `sumRegisterBalance(payload, id)` (`sum-transfers.ts:18`);
  - `sumFilteredByType(payload, { investment: { equals: id } })` (`:214`), then `deriveFinancials`
    (`investment-financials.ts:63`), then `calculateBalance` (`calculate-balance.ts:4`).
- **Forced N-th write failure:** `settle-payouts.test.ts:290-307` wraps `vi.spyOn(payload, 'create')`
  and delegates every call except the failing one. Restore it with `vi.restoreAllMocks()` in `afterEach`.
  `protectedAction` gets the same singleton (`run-action.ts:45`).
- **Discovery** greps for the literal `skipIf(!ENV_READY)` (`scripts/test-integration.sh:28-30`).
- **`withPayloadTransaction(payload, work, context, options?)`** (`with-payload-transaction.ts:15`)
  takes a mandatory context. A refusal _returned_ from inside it commits the earlier writes
  (`lessons.md:100-101`). Both fixes do all their checks before the first write, so nothing inside the
  transaction returns a refusal.

## What We're NOT Doing

- **Not moving, pruning or re-laying-out `src/__tests__/transfer-actions.test.ts`.** test-suite-audit is
  pruning it in the working tree, and its research proposes its own layout (`research.md:297-298`). This
  change touches the file only where Phase 2 forces it (see Phase 2 §3).
- No marża assertion, v1 or v2: the formula is undecided.
- No DB coverage of the invoice actions, and no change to their missing lock check. That intent is not
  verified; see research Open Questions.
- No INVESTMENT_EXPENSE_NET and no `materialsNetRate` in the scenario. They belong to the
  `wydatek-netto` change and `investment-render-parity-db`.
- No kosztorys v2 figures (bilans v2, marża v2). The tree exists only so the „Pozostało" pair row exists.
- No change to `updateTransferAction`'s field semantics (description blanked when omitted, non-LABOR_COST
  amount ignored). That is recorded as an open question, not fixed here.
- No change to `createTransferAction` / `createBulkTransferAction` behaviour.

## Implementation Approach

One scenario: a fresh investment, two fresh registers and one worker. A ledger of transfers is booked
through the actions, and after each step the figures are compared with literals. The oracle is the hand
calculation, never a value read from the code under test (test-plan §1). Phase 1 pins the create paths.
Phase 2 writes the atomicity tests red, then wraps cancel and update in a transaction and pins their
persisted effects. Phase 3 fixes the docs.

## Critical Implementation Details

- **Cleanup uses raw SQL, on entry and exit. Never `payload.delete` a transaction:**
  `deleteInvoiceMediaAfterDelete` removes media and Blob files (`collections/transfers.ts:80-82`).
  - The FKs into `transactions` are SET NULL, so delete in this order:
    1. `amount_edits` rows for the spec's transfers;
    2. CANCELLATION rows (marker in the cancel `reason`, or `cancelled_transaction_id IN (…)`);
    3. the spec's transactions, by description marker;
    4. the kosztorys tree;
    5. `purgeFixtureUsers`, then the investment.
  - `purgeFixtureUsers` reaches neither CANCELLATION nor `amount_edits` rows.
- **Transaction wiring:**
  - Pass `req` to both writes and use an empty context.
  - Do **not** pass `skipSheetSync` in cancel: the sheet row is removed by the update's afterChange hook,
    which schedules `syncSingleTransferToSheet` in `after()`. That re-reads the row after commit
    (`sheets-sync.ts:303-321`), so a rolled-back cancel syncs the persisted, uncancelled state.

## Phase 1: DB spec scaffold + create/bulk figures

### Overview

Create `transfers.db.test.ts` and pin the figures for every create path, BONUS included.

### Changes Required:

#### 1. New DB spec

**File**: `src/__tests__/lib/actions/transfers.db.test.ts`

**Intent**: Book the scenario ledger through `createTransferAction` and assert persisted state after each
step.

**Contract**:

- Carries the literal `skipIf(!ENV_READY)`. Mocks as in Key Discoveries. `authState` is the OWNER
  found in the DB.
- Fixtures:
  - a fresh investment with `materialsNetRate` null;
  - registers A and B via `createRegisterOwner`, with owner A as worker W;
  - a kosztorys tree where W's stage has progress worth `DUE` zł (the implementer picks the qty × price
    and writes it in the comment).
- Ledger (exact values may be adjusted; each literal keeps its arithmetic comment):

  | step | booked                          | reg A  | reg B | bucket moved    | bilans | Pozostało W |
  | ---- | ------------------------------- | ------ | ----- | --------------- | ------ | ----------- |
  | 0    | —                               | 0      | 0     | —               | 0      | DUE         |
  | 1    | INVESTOR_DEPOSIT 10 000 → A     | 10 000 | 0     | wpłaty 10 000   | 10 000 | DUE         |
  | 2    | INVESTMENT_EXPENSE 3 000 from A | 7 000  | 0     | materiały 3 000 | 7 000  | DUE         |
  | 3    | CORRECTION −200 from A          | 7 200  | 0     | materiały 2 800 | 7 200  | DUE         |
  | 4    | LABOR_COST 5 000                | 7 200  | 0     | robocizna 5 000 | 2 200  | DUE         |
  | 5    | RABAT 400                       | 7 200  | 0     | rabat 400       | 2 600  | DUE         |
  | 6    | LOSS 150                        | 7 200  | 0     | strata 150      | 2 750  | DUE         |
  | 7    | PAYOUT 1 000 from A to W        | 6 200  | 0     | wypłaty 1 000   | 2 750  | DUE − 1 000 |
  | 8    | BONUS 300 to W                  | 6 200  | 0     | premia 300      | 2 750  | DUE − 700   |
  | 9    | REGISTER_TRANSFER 500 A → B     | 5 700  | 500   | —               | 2 750  | DUE − 700   |

  bilans = wpłaty − (materiały + robocizna) + rabat + strata (`materialsNetDiscount` = 0).

- Also read back by SQL, per row:
  - LABOR_COST / RABAT / LOSS / BONUS persist with `source_register_id` NULL;
  - `payment_method` is NULL on every type that doesn't carry it;
  - PAYOUT has `payout_status = 'pending'`.
- **Refusals that persist zero rows:**
  - BONUS with `authState.role = 'MANAGER'` returns `BONUS_FORBIDDEN_MESSAGE`. Reset the role in
    `afterEach`.
  - A create against a locked investment returns `success: false`.
- **Bulk:**
  - `createBulkTransferAction` with N lines persists N rows and moves the source register by their sum.
  - A batch whose 2nd `payload.create` is forced to throw (spy as in `settle-payouts.test.ts:290-307`)
    persists **zero** rows and leaves the register unchanged.

### Success Criteria:

#### Automated Verification:

- `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env node_modules/vitest/vitest.mjs run src/__tests__/lib/actions/transfers.db.test.ts` passes with a non-zero test count
- The spec is picked up by discovery: `grep -l 'skipIf(!ENV_READY)' src/__tests__/lib/actions/transfers.db.test.ts`
- Break-verify once: flip one literal (e.g. step 8's Pozostało) and watch that test go red, then restore it

#### Manual Verification:

- None — test-only phase.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Atomic cancel + update (test-first)

### Overview

Pin cancel and update on persisted state, and make each one's write pair atomic. Write the failing tests
first.

### Changes Required:

#### 1. Cancel + update cases in the DB spec

**File**: `src/__tests__/lib/actions/transfers.db.test.ts`

**Intent**: Extend the scenario with cancellations, the LABOR_COST amount edit, and the two atomicity
cases.

**Contract**:

- **Cancel RABAT (step 5):** bilans −400, registers unchanged.
  - The original reads back `cancelled = true`.
  - Exactly one CANCELLATION row exists with `amount = 400`, `cancelled_transaction_id` = the original,
    source/target/investment/worker NULL, `date` = `warsawToday()`, and the reason in `description`.
- **Cancel INVESTMENT_EXPENSE (step 2):** register A +3 000, materiały −3 000, bilans +3 000.
- **Cancel CORRECTION (step 3):** register A −200, materiały +200, bilans −200. The CANCELLATION row
  stores `amount = −200`.
- **Cancel BONUS (step 8):** Pozostało W −300. Registers and bilans unchanged.
- **Cancel an already-cancelled transfer:** refused, and no second CANCELLATION row.
- **Cancel atomicity (red first):** with the CANCELLATION `payload.create` forced to throw, the action
  returns `success: false`, the original reads back `cancelled = false`, and no CANCELLATION row exists.
- **Update LABOR_COST 5 000 → 6 000:** robocizna 6 000, bilans −1 000, and one `amount_edits` row
  (previous 5 000, new 6 000).
- **Update atomicity (red first):** with the `amount-edits` create forced to throw, the action returns
  `success: false`, the transfer still reads 5 000, and there is no `amount_edits` row.
- Both atomicity tests must fail against today's code before the fix lands.

#### 2. Atomic cancel and update

**File**: `src/lib/actions/transfers.ts`

**Intent**: Write the cancelled flag with its CANCELLATION row, and the LABOR_COST amount with its
`amount-edits` row, each as one unit, so neither half of a pair can exist without the other.

**Contract**:

- `cancelTransferAction` and `updateTransferAction` each wrap their write pair in
  `withPayloadTransaction(payload, (req) => …, {})` and pass `req` to both calls.
- Every refusal (zod, `fetchAndAuthorize`, the net-amount check) stays before the transaction.
- Public signatures and `ActionResultT` are unchanged.

#### 3. Unit-spec fallout only

**File**: `src/__tests__/transfer-actions.test.ts`

**Intent**: Keep the mocked spec green once the writes carry `req`. Do nothing more; the file belongs to
test-suite-audit's in-flight work.

**Contract**:

- Run the file after the fix. Its Payload mock already provides `db.beginTransaction` /
  `commitTransaction` / `rollbackTransaction` (`:47-49`).
- Adjust only assertions that now fail because of the added `req` argument or the transaction
  (e.g. `expect.objectContaining`).
- Commit only those hunks, via the temp-index route (`safe-commit` step 4). The other agent's hunks stay
  in the working tree.
- If no case fails, the file is not touched.

### Success Criteria:

#### Automated Verification:

- Both atomicity tests fail before the fix and pass after it. Record both runs in the commit body.
- `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env node_modules/vitest/vitest.mjs run src/__tests__/lib/actions/transfers.db.test.ts` passes
- `pnpm exec vitest run src/__tests__/transfer-actions.test.ts` passes

#### Manual Verification:

- Transakcje → cancel a transfer with a reason. The row shows as anulowana, the „Anulowanie transakcji #…"
  row appears, and the register balance and the investment's bilans move back.
- Cancel a materials expense on an investment with a linked sheet. Its row disappears from the sheet,
  because the sync still fires after the transaction commits.
- Edit a robocizna amount on an investment. The new kwota shows, and the investment's bilans moves by the
  difference.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Docs

### Overview

Make the living docs match the code and record that risk #3 is covered.

### Changes Required:

#### 1. Financials doc

**File**: `context/foundation/investment-financials-and-discount.md`

**Intent**: Make the formulas in „The two displayed numbers" (`:92-101`) and the diagram (`:68-89`)
match the code.

**Contract**:

- bilans = `wpłaty − (materiały + robocizna) + rabat + materialsNetDiscount + strata` (`calculate-balance.ts:4-12`).
- marża v1 = `robocizna − wypłaty − rabat − strata − rozliczone − materialsNetDiscount` (`calculate-margin.ts:5-11`).
- Line refs: `investment-financials.ts:63`.
- The "no source register" branch lists BONUS, and `INVESTMENT_EXPENSE_NET` feeds materiały on its net
  amount.
- One line: owner, 2026-09-29 — marża's definition is not decided; tests pin its inputs, not the figure.

#### 2. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Mark risk #3 covered by `lib/actions/transfers.db.test.ts`, with marża excluded by decision.

**Contract**:

- Change only the risk #3 guidance / rollout cell.
- If the file has foreign uncommitted hunks at commit time, commit only this hunk (temp-index route).

### Success Criteria:

#### Automated Verification:

- None — docs only.

#### Manual Verification:

- None.

---

## Testing Strategy

### Integration Tests:

- The Phase 1–2 DB spec covers:
  - every figure-moving type, including BONUS and its MANAGER refusal;
  - the locked-investment refusal;
  - bulk commit and bulk rollback;
  - cancel of a no-register type (RABAT), a register type (expense), a negative type (CORRECTION) and
    BONUS;
  - double-cancel refusal;
  - the LABOR_COST edit;
  - cancel and update atomicity.

### Unit Tests:

- None new. The mocked spec stays as test-suite-audit leaves it.

## Performance Considerations

One investment and about 25 action calls: a few seconds in the unlocked single-file run.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- DB suite passes: `pnpm test:integration`

(The full unit suite runs in the pre-push hook; it is not re-run here unless asked.)

## References

- Research: `context/changes/2026-09-29-transfer-actions-db-spec/research.md`
- Audit origin: `context/changes/2026-09-15-test-suite-audit/research.md` §2 and „Re-pomiar 2026-09-29"
- Test plan risk #3: `context/foundation/test-plan.md:54, 87, 121`
- Patterns: `src/__tests__/lib/actions/worker-expense-drafts.db.test.ts`, `book-overpayment-bonus.test.ts`,
  `settle-payouts.test.ts:290-307`
- Lessons: shared-DB fixtures clean up on entry (`lessons.md:24-25`); a returned refusal commits
  (`:100-101`); a mocked writer asserts forbidden shapes succeed (`:85-87`); break-verify every guard
  (`:285-299`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB spec scaffold + create/bulk figures

#### Automated

- [x] 1.1 transfers.db.test.ts passes against the test DB
- [x] 1.2 spec is picked up by integration discovery
- [x] 1.3 break-verify: a flipped literal goes red

### Phase 2: Atomic cancel + update (test-first)

#### Automated

- [ ] 2.1 both atomicity tests red before the fix, green after
- [ ] 2.2 transfers.db.test.ts passes against the test DB
- [ ] 2.3 transfer-actions.test.ts passes

### Phase 3: Docs

#### Automated

- [ ] 3.1 none — docs only
