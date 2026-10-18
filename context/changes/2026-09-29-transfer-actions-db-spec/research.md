---
date: 2026-10-18T11:31:07+0200
researcher: Claude
git_commit: 20773384147f07bf06f1a3fc332bde5e500cb7ca
branch: staging
repository: wykonczymy
topic: 'EX-911 replan — transfer actions, figure-moving types incl. BONUS, DB spec harness, overlap with test-suite-audit'
tags: [research, transfers, server-actions, db-spec, test-plan-risk-3, bonus, cancellation]
status: complete
last_updated: 2026-10-18
last_updated_by: Claude
---

# Research: EX-911 replan

**Date**: 2026-10-18T11:31:07+0200
**Git Commit**: 207733841
**Branch**: staging
**Repository**: wykonczymy

## Research Question

The 2026-09-29 plan predates BONUS, atomic bulk create, document fields and the OTHER worker. 22 commits
have touched the transfer actions and collection since. What do the actions and types do today, which
figures each type moves, what harness a DB spec copies, and where the plan collides with the
test-suite-audit change?

## Summary

- **Risk #3 is still open.** No `skipIf(!ENV_READY)` spec calls `createTransferAction`,
  `cancelTransferAction` or `updateTransferAction`. Only `createBulkTransferAction` is reached on a real
  DB (`payout-without-stages.test.ts`, `worker-expense-drafts.db.test.ts`). The test-plan rollout row
  "Lock the financial core" is `not started` (`test-plan.md:121`).
- **Two non-atomic actions, not one.**
  - `cancelTransferAction` writes `update(cancelled:true)` and then `create(CANCELLATION)` with no
    transaction (`transfers.ts:287-304`).
  - `updateTransferAction` writes `update` and then `create('amount-edits')` with no transaction
    (`:348-376`).
  - In both cases, if the second write fails, the figures stay right and the audit row is lost.
- **BONUS is new and fully action-gated.**
  - It requires an investment and a worker; ADMIN/OWNER only. The gate is in the action
    (`canBookTransferType`, `transfers.ts:51`, `:147`), not in a hook.
  - It moves no register, no bilans and no v1 marża.
  - It raises the worker's „Pozostało do wypłaty", but that pair row exists only when the investment has
    kosztorys items (`db/worker-payout-pairs.ts:37-45`).
- **The old plan's Phase 3 is now another agent's work.** The test-suite-audit agent is pruning
  `transfer-actions.test.ts` in the working tree right now. It removed the zero/negative amount cases
  the old plan said to keep, and it staged deletions of `transfer-loss` / `transfer-rabat`. Its research
  proposes a different target layout (`lib/actions/transfer/{create,update,cancel,invoices}.test.ts`).
  EX-911 should not move or prune that file.
- **The financials doc is stale.**
  - Bilans is missing `+ materialsNetDiscount + strata`.
  - Marża v1 is missing `− materialsNetDiscount`.
  - Three line refs are wrong.
  - The "no source register" branch in the diagram omits BONUS.

## Detailed Findings

### Actions (`src/lib/actions/transfers.ts`)

All of them use `protectedAction` (ADMIN/OWNER/MANAGER, `run-action.ts:65-72`) and expire `['transfers']`.

| Action                                 | Gates                                                                                                     | Writes                                                                                                                | Transaction |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| `createTransferAction` `:42-94`        | zod → `canBookTransferType` `:51` → `validateSourceRegister` `:55` → `relatedInvestmentLockMessage` `:64` | one `payload.create` `:70`; PAYOUT → `after(notifyPendingPayouts)` `:84`                                              | n/a         |
| `createBulkTransferAction` `:116-234`  | same gates `:147-161`                                                                                     | N × create `:172` inside `withPayloadTransaction` `:165-212` (`skipSheetSync`); sync + notify after commit `:222-226` | yes         |
| `cancelTransferAction` `:271-315`      | zod reason (3–500), `fetchAndAuthorize` `:239-269`                                                        | update `:287`, create CANCELLATION `:294`                                                                             | **no**      |
| `updateTransferAction` `:317-384`      | zod, `fetchAndAuthorize`, net check `:341-346`                                                            | update `:348`, `amount-edits` create `:367` (only when the amount changed, `:339`)                                    | **no**      |
| invoice actions `:398`, `:416`, `:429` | `protectedAction` only                                                                                    | read-modify-write `payload.update`                                                                                    | no          |

`fetchAndAuthorize` refuses when: the row is missing, it is already cancelled, its type is CANCELLATION,
its investment is locked or trashed, or `!canMutateTransfer` (`roles.ts:50-60`). `canMutateTransfer`:
ADMIN/OWNER may change anything; anyone else only what they created; LABOR_COST may be changed by any
management role.

**What update edits today:**

- **Always rewritten:** description (missing → `''`), date, paymentMethod, investment, categories,
  invoiceNote, and the document fields (blank → `null`, `:353`).
- **amount:** LABOR_COST only (`:338`). For any other type the new amount is dropped silently and the
  action still returns success.
- **worker:** OTHER only (`:357`).
- **vatPlane / netAmount:** only while `canFillVatPlane` holds.
- **Never editable:** type, the registers, `settled`.

**Cancel writes** (`:287-304`):

- The original row gets `cancelled: true`. The validate hook returns early (`validate.ts:100`), and
  `syncSheetAfterChange` removes the sheet row inside `after()` (`sheets-sync.ts:303-311`).
- A CANCELLATION row is created with:
  - `amount = original.amount`, copied as-is. **A cancelled CORRECTION gives a negative CANCELLATION
    amount**, which corrects the old plan's "+original.amount".
  - `date = warsawToday()`.
  - `description = "Anulowanie transakcji #<id>\n<reason>"`.
  - `cancelledTransaction = id` and `createdBy` set.
  - The source register forced to null by the hook (`validate.ts:96`). Target, investment and worker are
    null only because the action never passes them.
- The sheet hook skips CANCELLATION rows.

### Types → figures

The sign rule comes from `getAmountError` (`validation.ts:6-11`): CORRECTION must be < 0, every other
type > 0. Field forcing is in `validate.ts`:

- Fields a type doesn't use are nulled: register `:136`, investment `:144`, worker `:164`, `settled`
  `:168`, net `:183`, vatPlane `:187`.
- paymentMethod is nulled only when the key is present (`:193-197`).
- payoutStatus is set to `pending` on a PAYOUT create (`:65-73`).

| Type                                  | Register balance    | Bucket (`deriveFinancials`)                  | Bilans v1     | Marża v1                 | Pozostało do wypłaty |
| ------------------------------------- | ------------------- | -------------------------------------------- | ------------- | ------------------------ | -------------------- |
| INVESTOR_DEPOSIT                      | +                   | wpłaty                                       | +             | —                        | —                    |
| INVESTMENT_EXPENSE                    | −                   | materiały (unsettled) / rozliczone (settled) | − (unsettled) | − (settled)              | —                    |
| INVESTMENT_EXPENSE_NET                | − gross             | materiały on net                             | − net         | via materialsNetDiscount | —                    |
| CORRECTION (< 0)                      | + (−(−x))           | materiały                                    | +             | —                        | —                    |
| LABOR_COST                            | —                   | robocizna                                    | −             | +                        | —                    |
| RABAT                                 | —                   | rabat                                        | +             | −                        | —                    |
| LOSS                                  | —                   | strata                                       | +             | −                        | —                    |
| BONUS                                 | —                   | premia                                       | —             | — (v2 only)              | +                    |
| PAYOUT                                | −                   | wypłaty                                      | —             | −                        | −                    |
| REGISTER_TRANSFER                     | − source / + target | —                                            | —             | —                        | —                    |
| OTHER, COMPANY_FUNDING, OTHER_DEPOSIT | ∓                   | — (no investment)                            | —             | —                        | —                    |
| CANCELLATION                          | —                   | —                                            | —             | —                        | —                    |

- **Register balance:** `sum-transfers.ts:25-44`, filtered `cancelled IS NOT TRUE`.
  - Source arm: deposits count +, every other type −.
  - Target arm: only `type='REGISTER_TRANSFER'`.
- **Buckets:** `sumFilteredByType` `:226-237` (`cancelled IS NOT TRUE`, grouped by type and settled), then
  `deriveFinancials` (`investment-financials.ts:63-99`).
- **Formulas:**
  - Bilans v1: `income − (materials + labor) + discount + materialsNetDiscount + loss`
    (`calculate-balance.ts:4-13`).
  - Marża v1: `labor − payouts − discount − loss − settled − materialsNetDiscount`
    (`calculate-margin.ts:5-11`).
  - Marża v2: `margin-v2.ts:9-22`.
  - Remaining for the crew: `due + bonus − payouts` (`margin-v2.ts:26-31`).
- **Pozostało per pair:** `selectWorkerPayoutPairs` (`db/worker-payout-pairs.ts:37-45`),
  `type IN ('PAYOUT','BONUS') AND cancelled IS NOT TRUE`. It requires kosztorys items on the investment.
  `payout_status` is not filtered.

### DB spec harness

- **Discovery:** `scripts/test-integration.sh:28-30` greps for the literal `skipIf(!ENV_READY)`.
  - The `.db.test.ts` suffix is only a convention.
  - The run uses `--no-file-parallelism` against `DB_POSTGRES_URL_TEST`.
  - Single file: `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env node_modules/vitest/vitest.mjs run <file>`.
- **Mock block:** copy `payout-without-stages.test.ts:11-29` or `worker-expense-drafts.db.test.ts:12-32`.
  - `server-only` (it is already aliased globally, `vitest.config.ts:14`).
  - `next/server` `after: () => {}`.
  - `requireAuth` driven by a `vi.hoisted` `authState`.
  - `@/lib/cache/revalidate` via `() => import('@/__tests__/stubs/cache-revalidate')`; a hand-rolled
    factory breaks `protectedAction` (`__tests__/AGENTS.md:10-15`).
  - Import the action dynamically after the mocks.
  - **For a mutable role** (the BONUS refusal as MANAGER), use `vi.hoisted(() => ({ userId: 0, role: 'OWNER' }))`
    and reset it in `afterEach` (`book-overpayment-bonus.test.ts:19-25`, `:106-107`).
- **Payload instance:** the real singleton from `getPayload({ config })` in `beforeAll`, the same one
  `protectedAction` uses (`run-action.ts:45`). No spec mocks `getPayload`.
- **Fixtures** (`src/__tests__/helpers/`):
  - `createTestInvestment` / `deleteTestInvestment` (`investment.ts:15`, `:29`).
  - `createRegisterOwner` gives an EMPLOYEE plus an AUXILIARY register (`transfer-fixtures.ts:3`). It
    serves as worker and register, but cannot authenticate the action.
  - `purgeFixtureUsers` (`purge-fixture-users.ts:10`).
  - `createKosztorysTree` (`kosztorys-db-tree.ts:46`).
  - `pairRemaining(db, investmentId, workerId)` (`pair-remaining.ts:6`).
  - `round2` (`money.ts`).
- **No helper for an OWNER or a category.** Find them as `worker-expense-drafts.db.test.ts:114-129` does.
- **Cleanup:** raw SQL, on entry and exit (`lessons.md:24-25`, `invoice-on-cancellation.db.test.ts:30-31, 72-74`).
  - Never use `payload.delete` on transactions: `deleteInvoiceMediaAfterDelete` removes media and Blob
    files (`collections/transfers.ts:80-82`).
  - The FKs into `transactions` are SET NULL (`cancelled_transaction_id`, `amount_edits.transaction_id`)
    or CASCADE. So delete `amount_edits` and the CANCELLATION rows explicitly; `purgeFixtureUsers` misses
    both.
  - Put the description marker in the cancel `reason`, so it lands in the CANCELLATION description.
- **Forced failure:** `settle-payouts.test.ts:290-307` wraps `vi.spyOn(payload, 'create')`, throws on the
  N-th call, delegates the rest, and restores via `vi.restoreAllMocks()` in `afterEach`.
  - `withPayloadTransaction` rollback is proven indirectly (`restore-rollback.test.ts:52-88`, settle-payouts).
  - Bulk create's rollback is proven only with mocks (`bulk-transaction.test.ts:80-91`).
- **Read-back:** use the uncached `lib/db` functions: `sumRegisterBalance(payload, id)` `:18`,
  `sumFilteredByType(payload, where)` `:214`, then `deriveFinancials` and `calculateBalance`, plus
  `pairRemaining`. Not the `queries/transfer-totals.ts` fetchers, which go through `cached()`.

### Overlap with test-suite-audit

- **Status:** `preparing`. `phase-2-redundant-tests.md` is untracked and was still being written during
  this research.
- **Uncommitted diff (142 files, −1734):**
  - `transfer-actions.test.ts` has lost the zero/negative amount and "valid INVESTMENT_EXPENSE" cases
    (HEAD 1197 lines / 76 `it`; tree 1165 / 73).
  - `bulk-transaction.test.ts` has lost "commits when all items succeed" and "creates share the same
    transaction ID".
  - `transfer-loss` and `transfer-rabat` are staged for deletion; their truth table already lives in
    `transfer-constants.test.ts`.
- **Its research:**
  - §2 (`research.md:297-298`) proposes `lib/actions/transfer/{create,update,cancel,invoices}.test.ts`
    plus a `.db.test.ts`.
  - Open questions `:537-540` ask whether to rewrite transfer-actions on the DB or delete it, and whether
    to migrate the root of `__tests__/` to the mirror layout.
  - Mirror moves are deferred to an unwritten "phase 3".
- **`2026-09-22-kosz-plikow`** (planned) edits the invoice-removal cases in the same spec file
  (`transfer-actions.test.ts:1103-1138`).
- **`2026-09-24-wydatek-netto-…`** changes `deriveFinancials` for INVESTMENT_EXPENSE_NET under brutto.
  It is out of the way as long as the EX-911 ledger books no NET expense.
- **No source collision:** nothing under `src/lib/actions/` or `src/lib/db/` is modified in the tree.

### Docs

- **`investment-financials-and-discount.md:92-101`** is stale:
  - Bilans is missing `+ materialsNetDiscount + strata`.
  - Marża v1 is missing `− materialsNetDiscount`.
  - Line refs: `investment-financials.ts:34` → `:63`; `calculate-balance.ts:6-8` → `:4-12`;
    `calculate-margin.ts:13-14` → `:5-11`.
  - The diagram at `:68-89` omits `INVESTMENT_EXPENSE_NET` and lists only LABOR_COST/RABAT/LOSS as
    having no register.
  - BONUS is otherwise documented (`:22`, `:151`, `:196-241`, `:252`), and the v2 formula is correct.
- **`test-plan.md`:**
  - Risk #3 is at `:54` (map) and `:87` (guidance).
  - The rollout row is at `:121`.
  - Nothing names EX-911.

## Code References

- `src/lib/actions/transfers.ts:42-94` — single create
- `src/lib/actions/transfers.ts:165-212` — bulk create transaction
- `src/lib/actions/transfers.ts:239-269` — `fetchAndAuthorize`
- `src/lib/actions/transfers.ts:287-304` — non-atomic cancel
- `src/lib/actions/transfers.ts:338-376` — update + amount-edits, non-atomic
- `src/lib/auth/roles.ts:24, 50-60` — `canBookTransferType`, `canMutateTransfer`
- `src/hooks/transfers/validate.ts:65-197` — field forcing
- `src/lib/db/sum-transfers.ts:18, 25-44, 214, 226-237` — register balance, buckets
- `src/lib/db/investment-financials.ts:63-99` — `deriveFinancials`
- `src/lib/db/calculate-balance.ts:4-13`, `calculate-margin.ts:5-11`, `src/lib/kosztorys/margin-v2.ts:9-31`
- `src/lib/db/worker-payout-pairs.ts:37-45` — Pozostało pairs (needs kosztorys items)
- `src/lib/db/with-payload-transaction.ts:15-32`
- `src/__tests__/lib/actions/worker-expense-drafts.db.test.ts:12-32, 114-138` — mock + fixture template
- `src/__tests__/lib/actions/settle-payouts.test.ts:290-307` — forced N-th create failure
- `src/__tests__/lib/actions/book-overpayment-bonus.test.ts:19-25, 44-55, 124-142` — mutable role, BONUS + `pairRemaining`

## Architecture Insights

- Role gates for transfer types live only in the actions. A hook-level DB test cannot see them, so the
  spec must go through the actions.
- Every multi-row writer added since September (bulk create, settle payouts, overpayment bonus) uses
  `withPayloadTransaction`. Cancel and update are the two leftovers from before.
- CANCELLATION is invisible to the figures only because its three FKs are null and it is excluded by
  `cancelled IS NOT TRUE` on the original. No figure query filters on the CANCELLATION type except
  `sum-transfers.ts:266`.

## Historical Context

- `context/changes/2026-09-15-test-suite-audit/research.md` §2 and „Re-pomiar 2026-09-29" are the origin
  of EX-911. The work was split into EX-910..EX-913 in commit 51fdf11b2. EX-912/913 cover the other root
  transfer specs.
- `phase-1-dead-tests.md:31-32` deliberately kept `transfer-actions.test.ts` cases for "management books
  from any register" and "no double sheet sync".
- Owner, 2026-09-29: marża's definition differs between v1 and v2 and is undecided. Don't pin a marża
  figure.

## Open Questions

- `updateTransferAction` blanks `description` and the document fields when the caller omits them, and it
  silently ignores a non-LABOR_COST amount. Is that intended? The client form probably always sends
  every field. Out of scope for a test change; note it, don't fix it.
- The invoice actions skip `fetchAndAuthorize`, so invoices can be attached on locked or cancelled rows.
  Intent is not checked. Out of scope here.
