# Transfer actions asserted on persisted state (EX-911) Implementation Plan

## Overview

Close test-plan risk #3: after a transfer is created, cancelled or updated through the real server
actions, the register balance and the investment figures read back from Postgres must equal values
computed by hand. Today the only spec for these actions (`src/__tests__/transfer-actions.test.ts`,
1 195 LOC, 77 `it`) runs against a fully mocked Payload and never reads anything back. Along the way,
fix the non-atomic `cancelTransferAction` test-first, slim the unit spec down to what a mock can
honestly prove, and correct the stale formulas in the financials doc.

## Current State Analysis

- **No DB spec calls `createTransferAction` / `cancelTransferAction` / `updateTransferAction`.** The
  only DB spec that calls a transfer action at all is `src/__tests__/lib/actions/payout-without-stages.test.ts`
  (`createBulkTransferAction`, read-back by raw SQL on a description marker).
- **The unit spec defends the mock.** Classification of its 77 `it`: 26 rejection/validation/auth
  (legitimately unit), 27 write-shape `toHaveBeenCalledWith` (what a read-back replaces), 8
  side-effect, 16 injected-failure or implementation detail. Specific defects:
  - `paymentMethod: 'CASH'` asserted on `INVESTMENT_EXPENSE` / `PAYOUT` writes (`:205`, `:364`, `:426`,
    `:750`) — `hooks/transfers/validate.ts:188` nulls it for every type without `carriesPaymentMethod`,
    so the asserted shape never persists.
  - `:278` / `:284` pass with register validation deleted — the investment-lock query alone satisfies
    `toHaveBeenCalled()` on the shared `mockDbExecute`.
  - `:659` compares a UTC `toISOString()` date against the action's `warsawToday()` — red between
    00:00 and 01:00/02:00 Warsaw time.
  - The `sumRegisterBalance → 99999` mock (`:100-102`) is dead: nothing these actions import reads it
    (`validate-source-register.ts:44`, "no sufficient-funds guard by design").
- **`cancelTransferAction` is not atomic** (`src/lib/actions/transfers.ts:213-231`): `payload.update
({cancelled: true})` then `payload.create(CANCELLATION)`, no transaction. A failed second write
  leaves the original cancelled with no audit row. The unit spec's `:707` injects exactly that
  failure and asserts only `success: false`.
- **Uncovered anywhere:** the LABOR_COST amount edit and its `amount-edits` audit row
  (`transfers.ts:265-267, 297-307`); the refusal on a locked investment (`relatedInvestmentLockMessage`).
- **Marża's definition is not settled** (owner, 2026-09-29): v1 and v2 disagree and the formula is
  still open. The spec therefore must not pin a marża figure.

## Desired End State

- `src/__tests__/lib/actions/transfers.db.test.ts` runs every figure-moving transfer type through the
  real actions against the 5435 test DB and asserts, as hand-written literals: the register balance
  (`sumRegisterBalance`), the transactions-plane buckets (`deriveFinancials` over `sumFilteredByType`:
  wpłaty, materiały, rozliczone, robocizna, wypłaty, rabat, strata) and the bilans (`calculateBalance`).
  Cancel and update are covered the same way, plus the persisted audit rows.
- `cancelTransferAction` writes both rows in one Payload transaction; a DB test proves that a failed
  audit-row write leaves the original **not** cancelled.
- The unit spec lives at the mirror path `src/__tests__/lib/actions/transfers.test.ts` and holds only
  refusals, the invoice-list logic and the injected-failure cases that guard real error handling.
- `context/foundation/investment-financials-and-discount.md` states the code's bilans formula and
  records that marża is open.

Verify: `pnpm exec vitest run src/__tests__/lib/actions/transfers.db.test.ts` (with
`DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST`) and `pnpm exec vitest run src/__tests__/lib/actions/transfers.test.ts`
both green; `grep -c toHaveBeenCalledWith` on the unit spec drops from 39 to only the ones that assert
a refusal short-circuited the write.

### Key Discoveries:

- Mock set to copy: `payout-without-stages.test.ts:11-27` — `server-only`; `next/server` with `after: () => {}`
  (neutralises the per-row Sheets sync scheduled by `syncSheetAfterChange`, `hooks/transfers/sync-sheet.ts:22-46`);
  `requireAuth` via a `vi.hoisted` `authState` whose `userId` is a **real** user (the action writes the
  `createdBy` FK); `@/lib/cache/revalidate` → `() => import('@/__tests__/stubs/cache-revalidate')`.
  `next/cache` is aliased globally (`vitest.config.ts`), so `recalcAfterChange`'s `revalidateTag` is safe.
- Fixtures: `createTestInvestment` / `deleteTestInvestment` (`helpers/investment.ts`), `createRegisterOwner`
  (`helpers/transfer-fixtures.ts:8`, EMPLOYEE + AUXILIARY register), `purgeFixtureUsers` (on entry and exit,
  per the lesson "shared-DB fixtures must clean up on ENTRY").
- Read-back functions take `payload`, not a db handle: `sumRegisterBalance(payload, registerId)`
  (`lib/db/sum-transfers.ts:28`), `sumFilteredByType(payload, { investment: { equals: id } })` (`:280`),
  then `deriveFinancials(rows)` (`lib/db/investment-financials.ts:79`) and `calculateBalance(f)`
  (`lib/db/calculate-balance.ts:12`). Precedent: `financial-golden-master-db.test.ts:273-310`.
- Cancel pair semantics: the original drops out via `cancelled IS NOT TRUE`; the CANCELLATION row stores
  **`+original.amount`** (not negated) with `source_register_id`, `target_register_id` and `investment_id`
  all NULL, which is the only reason no figure query sees it.
- `withPayloadTransaction(payload, work, context, options?)` (`lib/db/with-payload-transaction.ts:23`) —
  context is mandatory and carries no default.
- `syncSingleTransferToSheet` re-reads the transfer from the DB inside `after()` (`lib/actions/sheets-sync.ts:312-321`),
  so a rolled-back cancel syncs the persisted (not-cancelled) state — wrapping cancel in a transaction
  does not desync the sheet.

## What We're NOT Doing

- No marża assertion (formula undecided). Its inputs are pinned; the combination is not.
- No DB coverage of the invoice actions (`add/remove/removeAllTransferInvoicesAction`,
  `deleteOrphanedMediaAction`) — the attach-order logic is pure and stays unit; media deletion reaches
  the Blob adapter.
- No `materials_net_rate` / NET-settlement discount in the scenario — it stays null so
  `materialsNetDiscount = 0`; that plane is `investment-render-parity-db`'s job.
- No kosztorys (v2) figures — LABOR_COST / RABAT transfers move only the v1 plane.
- No refactor of the other root-level transfer specs (`transfer-loss`, `transfer-rabat`, `bulk-transaction`, …) — EX-912/913.
- No change to `updateTransferAction` or `createBulkTransferAction` behaviour.

## Implementation Approach

One scenario, one fresh investment, two fresh registers, a ledger of transfers booked through the
actions — and after each step the figures are compared with literals whose arithmetic is written in a
comment next to them. The oracle is the hand calculation, never a value read from the code under test
(test-plan §1). Build the DB spec first, then put the cancel fix through it test-first, then shrink the
unit spec to what it can honestly assert, then docs.

## Critical Implementation Details

- **Cleanup by raw SQL, never `payload.delete` on transactions.** `deleteInvoiceMediaAfterDelete`
  deletes unreferenced media (and its Blob file) synchronously. Delete in FK order, on entry and exit:
  `amount_edits` for the spec's transfers, CANCELLATION rows by `cancelled_transaction_id`, then the
  spec's transactions by description marker; then `purgeFixtureUsers` and the investment.
  `purgeFixtureUsers` does **not** reach CANCELLATION or `amount_edits` rows (no register, no worker).
- **Forcing the audit-row failure against a real DB:** the action's `getPayload` returns the same
  singleton the spec holds, so `vi.spyOn(payload, 'create').mockRejectedValueOnce(...)` makes the
  CANCELLATION create throw without touching the update. Restore the spy in the same test.
- **Transaction wiring in cancel:** pass `req` to both `payload.update` and `payload.create`, and an
  empty context — do **not** pass `skipSheetSync`, the sheet row removal rides on the update's
  afterChange hook.

## Phase 1: DB spec scaffold + create/bulk figures

### Overview

Stand up `transfers.db.test.ts` and pin the figures for every create path.

### Changes Required:

#### 1. New DB spec

**File**: `src/__tests__/lib/actions/transfers.db.test.ts`

**Intent**: Book the scenario ledger through `createTransferAction` and assert persisted state after it.

**Contract**:

- Carries the literal `skipIf(!ENV_READY)` (discovery by `scripts/test-integration.sh`).
- Mocks as in Key Discoveries; `authState` role OWNER, `userId` = a fixture user created in `beforeAll`.
- Fixture: fresh investment (`materialsNetRate` left null), register A and register B via `createRegisterOwner`,
  a worker for PAYOUT (the register owner can serve).
- Scenario and expected literals (exact values may be adjusted by the implementer, but each literal
  keeps its arithmetic comment):

  | step | booked                                   | register A | register B | bucket moved    | bilans |
  | ---- | ---------------------------------------- | ---------- | ---------- | --------------- | ------ |
  | 1    | INVESTOR_DEPOSIT 10 000 from A           | 10 000     | 0          | wpłaty 10 000   | 10 000 |
  | 2    | INVESTMENT_EXPENSE 3 000 from A          | 7 000      | 0          | materiały 3 000 | 7 000  |
  | 3    | CORRECTION −200 from A                   | 7 200      | 0          | materiały 2 800 | 7 200  |
  | 4    | LABOR_COST 5 000                         | 7 200      | 0          | robocizna 5 000 | 2 200  |
  | 5    | RABAT 400                                | 7 200      | 0          | rabat 400       | 2 600  |
  | 6    | LOSS 150                                 | 7 200      | 0          | strata 150      | 2 750  |
  | 7    | PAYOUT 1 000 from A (worker, investment) | 6 200      | 0          | wypłaty 1 000   | 2 750  |
  | 8    | REGISTER_TRANSFER 500 A → B              | 5 700      | 500        | —               | 2 750  |

  bilans = wpłaty − (materiały + robocizna) + rabat + strata (`materialsNetDiscount` = 0).

- Also per row read back by SQL: LABOR_COST / RABAT / LOSS persist with `source_register_id` NULL;
  `payment_method` NULL on types that do not carry it; `settled` false.
- Locked investment: a create against an investment the lock gate refuses returns `success: false`
  and persists zero rows.
- Bulk: `createBulkTransferAction` with N lines persists N rows and moves the source register by their
  sum; a batch whose second line fails (e.g. a non-existent category FK) persists **zero** rows.

### Success Criteria:

#### Automated Verification:

- `DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST pnpm exec vitest run src/__tests__/lib/actions/transfers.db.test.ts` passes
- The spec is picked up by discovery: `grep -rl 'skipIf(!ENV_READY)' src/__tests__ | grep transfers.db`

#### Manual Verification:

- None — test-only phase.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Cancel (atomic, test-first) + update

### Overview

Pin cancel and update on persisted state; fix the half-written cancel with a failing test first.

### Changes Required:

#### 1. Cancel + update cases in the DB spec

**File**: `src/__tests__/lib/actions/transfers.db.test.ts`

**Intent**: Extend the scenario with cancellations and the LABOR_COST amount edit.

**Contract**:

- Cancel RABAT (step 5): bilans −400, registers unchanged; original `cancelled = true`; one CANCELLATION
  row with `amount = +400`, `cancelled_transaction_id` = original, source/target/investment NULL,
  `date` = `warsawToday()`, reason in `description`.
- Cancel INVESTMENT_EXPENSE (step 2): register A +3 000, materiały −3 000, bilans +3 000.
- Cancel an already-cancelled transfer → refused, no second CANCELLATION row.
- **Atomicity (red first):** with the CANCELLATION create forced to throw, the action returns
  `success: false` **and** the original reads back `cancelled = false` with no CANCELLATION row.
  Must fail against today's code before the fix lands.
- Update LABOR_COST 5 000 → 6 000: robocizna 6 000, bilans −1 000, one `amount_edits` row
  (previous 5 000, new 6 000).

#### 2. Atomic cancel

**File**: `src/lib/actions/transfers.ts`

**Intent**: Write the cancelled flag and the CANCELLATION audit row as one unit, so neither can exist
without the other.

**Contract**: `cancelTransferAction` wraps both writes in `withPayloadTransaction(payload, (req) => …, {})`,
passing `req` to both calls. Public signature and `ActionResultT` unchanged.

### Success Criteria:

#### Automated Verification:

- The atomicity test fails before the fix and passes after it (both runs recorded in the commit body)
- `DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST pnpm exec vitest run src/__tests__/lib/actions/transfers.db.test.ts` passes

#### Manual Verification:

- Transakcje → cancel a transfer with a reason: the row shows as anulowana, the „Anulowanie transakcji #…"
  row appears, the register balance and the investment's bilans move back.
- Cancel a materials expense on an investment with a linked sheet: its row disappears from the sheet
  (sync still fires after the transaction commits).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Slim the unit spec to its mirror path

### Overview

Keep only what a mocked Payload can honestly prove; move the file where the mirror rule puts it.

### Changes Required:

#### 1. Move + prune

**File**: `src/__tests__/transfer-actions.test.ts` → `src/__tests__/lib/actions/transfers.test.ts` (`git mv`)

**Intent**: Remove the cases the DB spec now proves on persisted state and the ones that assert
implementation detail or an impossible shape.

**Contract**:

- **Keep:** zod/refusal cases (missing/zero/negative amount, invalid type, missing date, empty bulk,
  source-register failure, not found, already cancelled, CANCELLATION type, MANAGER non-creator refused,
  brutto fill-in refused); the invoice-list cases (`addTransferInvoicesAction` append/dedup/order,
  `remove…`, `removeAll…`, `deleteOrphanedMediaAction`); injected-failure cases for the update and
  invoice paths (`:924`, `:1088`, `:1186`).
- **Delete:** every write-shape case replaced by Phase 1–2 (create/bulk/cancel/update `toHaveBeenCalledWith`
  on row data, incl. the four `paymentMethod: 'CASH'` assertions); `:278`, `:284`, `:290`, `:718`
  (implementation detail); `:659` (UTC date — covered by the DB spec); `:696`, `:707` (cancel failures —
  covered on real state); the allowed-case permission tests that assert only `success` (`:410`, `:618`,
  `:627`, `:636`, `:873`, `:895`, `:904`) except one MANAGER-own case per action (cancel `:618`, update
  `:873`) — `canMutateTransfer` has no spec of its own, so those two plus the two refusals are its only
  guard; `:685`, `:913` (populated relations at depth 0 — impossible).
- Drop the dead `sumRegisterBalance` mock.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/transfers.test.ts` passes
- `src/__tests__/transfer-actions.test.ts` no longer exists

#### Manual Verification:

- None — test-only phase.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Docs

### Overview

Make the living docs match the code and record the open marża question.

### Changes Required:

#### 1. Financials doc

**File**: `context/foundation/investment-financials-and-discount.md` (section „The two displayed numbers")

**Intent**: State the formulas the code computes, and mark marża's definition as open.

**Contract**: bilans = `wpłaty − (materiały + robocizna) + rabat + materialsNetDiscount + strata`
(`calculate-balance.ts`); marża = `robocizna − wypłaty − rabat − strata − rozliczone − materialsNetDiscount`
(`calculate-margin.ts`); one line: owner, 2026-09-29 — marża differs between v1 and v2 and its
definition is not decided; tests pin its inputs, not the figure.

#### 2. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Mark risk #3 covered by `lib/actions/transfers.db.test.ts` (marża excluded, by decision).

**Contract**: the risk #3 row / rollout status only. Another session has uncommitted edits in this
file — commit only this hunk (safe-commit temporary-index route).

### Success Criteria:

#### Automated Verification:

- None — docs only.

#### Manual Verification:

- None.

---

## Testing Strategy

### Integration Tests:

- The Phase 1–2 DB spec is the whole point: every figure-moving type, cancel of a no-register type
  (RABAT) and of a register type (expense), the LABOR_COST edit, the locked-investment refusal, bulk
  commit and bulk rollback, cancel atomicity.

### Unit Tests:

- What remains in `lib/actions/transfers.test.ts`: refusals and the invoice-list logic.

## Performance Considerations

One investment, ~15 action calls — a few seconds under the unlocked single-file run.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- DB suite passes: `pnpm test:integration`

(The full unit suite runs in the pre-push hook; not re-run here unasked.)

## References

- Audit: `context/changes/2026-09-15-test-suite-audit/research.md` §2 and „Re-pomiar 2026-09-29"
- Test plan risk #3: `context/foundation/test-plan.md`
- Pattern: `src/__tests__/lib/actions/payout-without-stages.test.ts`, `src/__tests__/financial-golden-master-db.test.ts:273-310`
- Lessons: „Restore + migrate are one operation, and shared-DB fixtures must clean up on ENTRY";
  „An action spec with a mocked writer can assert that a forbidden shape SUCCEEDS"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB spec scaffold + create/bulk figures

#### Automated

- [ ] 1.1 transfers.db.test.ts passes against the test DB
- [ ] 1.2 spec is picked up by integration discovery

### Phase 2: Cancel (atomic, test-first) + update

#### Automated

- [ ] 2.1 atomicity test red before the fix, green after
- [ ] 2.2 transfers.db.test.ts passes against the test DB

### Phase 3: Slim the unit spec to its mirror path

#### Automated

- [ ] 3.1 lib/actions/transfers.test.ts passes
- [ ] 3.2 root transfer-actions.test.ts removed

### Phase 4: Docs

#### Automated

- [ ] 4.1 none — docs only
