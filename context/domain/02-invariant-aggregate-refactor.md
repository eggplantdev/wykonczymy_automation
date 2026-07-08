---
title: Invariant Guardian Refactor — Register Sufficient-Funds
created: 2026-07-08
type: refactor-plan
---

# Invariant Guardian Refactor — "An auxiliary register must not go negative"

A **plan**, not an implementation. No production code is changed here. Every
citation is verified `file:line`. Builds on
[`01-domain-distillation.md`](./01-domain-distillation.md).

---

## KROK 0 — Context

Next.js App Router + Payload CMS on Postgres. Business-logic layers relevant to
this invariant:

- **Client forms** — `src/components/forms/*` (display projected balance)
- **Server actions** — `src/lib/actions/transfers.ts` (mutations from the app UI)
- **Payload hooks** — `src/hooks/transfers/*` (`beforeValidate`, `afterChange`)
- **Read model** — `src/lib/db/sum-transfers.ts` (balance as a live SUM, no stored column)
- **DB** — migrations; no CHECK/trigger

Key architectural fact that shapes the whole design: **balance is not stored**, it
is `SUM(CASE …)` computed on read (`sum-transfers.ts:29-48`). There is therefore
no aggregate row to load-mutate-save. The "guardian aggregate" here is not an
object with state — it is a **single enforced choke point** that consults the read
model _before_ a write is allowed to commit.

---

## KROK 1 — Business invariants (candidate list)

Pulled from docs + code (full list in `01-domain-distillation.md` §KROK 3):

| #   | Invariant                                                                                                              | Source                                                    | Enforced today?             |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------- |
| I1  | **An AUXILIARY register must not go negative** — a non-deposit, non-correction withdrawal requires `balance ≥ amount`. | `validate-source-register.ts:43-45` (doc), prd guardrails | **NO — zero layers**        |
| I2  | CORRECTION amount must be negative; all other types positive.                                                          | `validation.ts:7-12`                                      | YES (`validate.ts:47-51`)   |
| I3  | robocizna/rabat/loss have no source_register.                                                                          | `transfer-rules.ts:52-53`                                 | YES (`validate.ts:54-61`)   |
| I4  | Balance computed on read, never stored.                                                                                | `recalculate-balances.ts:16-18`                           | YES (by construction)       |
| I5  | Only LABOR_COST amounts are editable after creation.                                                                   | `actions/transfers.ts:271-273`                            | YES (action + field access) |
| I6  | Register with referencing transactions cannot be deleted.                                                              | `cash-registers.ts:17-31`                                 | YES                         |

---

## KROK 2 — Classify and pick #1

Three axes: (a) core to product, (b) how spread across layers, (c) actually enforced?

| Invariant               | (a) Core                                                                          | (b) Spread                                        | (c) Enforced                     | Pick     |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- | -------- |
| **I1 sufficient funds** | **High** — cash-ledger integrity is the financial core the whole product protects | Was 1 place, now 0; belongs at the write boundary | **Violable — no layer stops it** | **★ #1** |
| I2–I6                   | High                                                                              | Localized                                         | Already enforced                 | —        |

**#1 = I1.** It is the only invariant that scores _core_ on value **and** _unenforced_
on risk — exactly the "most core ∧ weakest" target the method calls for. I2–I6 are
already defended; re-touching them is churn. I1 is a live hole: today a withdrawal
exceeding an auxiliary register's balance **writes successfully at every layer**,
the only signal being the balance later rendering red (`saldo-display.tsx:9`).

**Scope of the rule (the carve-outs matter — don't lose them):**

- Applies to **AUXILIARY registers only.** MAIN (owner, "can do whatever he
  wants"), VIRTUAL (designed to run negative), WORKER (pays from own money → may go
  negative) are **exempt**. Source: `validate-source-register.ts:43-45,56`.
- Applies to **withdrawals only.** Deposits (money in) and CORRECTION (accounting
  adjustment) are **skipped**: `if (!isDepositType(type) && type !== 'CORRECTION')`
  (`transfers.ts:48`).
- For a **bulk** create, the check is against the **summed** line items, not each
  row (`transfers.ts:102`).

---

## KROK 3 — Diagnosis of I1 across layers

| Layer                  | File:line                                                                  | Enforces?                                                               | Failure mode                                  |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| Client form            | `expense-form.tsx`, `internal-transfer-form.tsx`; `saldo-display.tsx:6-13` | **NO** — displays "Saldo po transakcji", turns red, never blocks submit | silently allows                               |
| Server action (single) | `transfers.ts:44-56`                                                       | **NO** — commented out                                                  | write proceeds                                |
| Server action (bulk)   | `transfers.ts:97-110`                                                      | **NO** — commented out                                                  | write proceeds (atomic but unbounded)         |
| Guard function         | `validate-source-register.ts:51-65`                                        | **N/A** — commented out                                                 | _would_ return `{success:false}` → clean halt |
| `beforeValidate` hook  | `validate.ts:21-111`                                                       | **NO** — field/sign rules only, no balance rule                         | —                                             |
| `afterChange` hook     | `recalculate-balances.ts:19-49`                                            | **NO** — cache-only, runs **post-commit**                               | cannot halt                                   |
| Read model (SQL)       | `sum-transfers.ts:29-48`                                                   | **NO** — `ELSE -amount`, no floor, returns signed                       | can go negative                               |
| DB constraint/trigger  | migrations, `cash-registers.ts`                                            | **NO** — none exist                                                     | —                                             |

**The critical finding for design:** the old guard lived in the **server actions**
only (`transfers.ts:44-56`). That means a transfer written through the **Payload
admin panel or REST/Local API** never hit it even when it existed. The
`beforeValidate` hook (`validate.ts`) is the one choke point that covers **both**
the app's server actions **and** direct admin/API writes — and it already halts
fail-fast via `throw` (`validate.ts:106`). That is where the guardian belongs.

Swallow-vs-halt today: nothing halts. When the guard existed it halted cleanly
(action returned `{success:false, error}`, surfaced to the form). We want to keep
that clean-halt UX for the app path while adding hook-level coverage for the
admin/API path.

---

## KROK 4 — Guardian design

### The tension, stated plainly

A classic DDD aggregate would be `class CashRegister { withdraw(amount) { if (this.balance < amount) throw … } }` — load, mutate, save through a repository in one
transaction. **That doesn't fit here**: there is no `balance` field to load and
mutate; balance is a query, and the "mutation" is inserting a _transfer_ row, not
updating the register. Forcing an aggregate-root object would mean re-materializing
the balance column that migration `20260222_drop_materialized_columns.ts:5`
deliberately dropped.

So the guardian is expressed as: **one domain function (the invariant, pure) +
one enforcement point (the hook, fail-fast) + a named domain error.**

### 4a. The invariant as a named domain function

Restore and relocate the dropped logic into a single, side-effect-light domain
function. Proposed home: `src/lib/db/assert-sufficient-funds.ts` (sits next to the
read model it consults).

```ts
// Named domain error — not a bare Error, so callers can map it deliberately.
export class InsufficientFundsError extends Error {
  constructor(
    readonly registerId: number,
    readonly currentBalance: number,
    readonly attempted: number,
  ) {
    super(
      `Niewystarczające saldo kasy (${currentBalance.toFixed(2)} zł). ` + `Najpierw dodaj środki.`,
    )
    this.name = 'InsufficientFundsError'
  }
}

// The invariant, in ONE place. Pure precondition check; throws on violation.
// Carve-outs are arguments, not scattered `if`s at each call site.
export async function assertSufficientFunds(
  payload: Payload,
  register: CashRegisterT, // already loaded by the caller
  withdrawalAmount: number, // positive; for bulk = summed line items
): Promise<void> {
  if (register.type !== 'AUXILIARY') return // MAIN/VIRTUAL/WORKER exempt
  const balance = await sumRegisterBalance(payload, register.id)
  if (balance >= withdrawalAmount) return
  throw new InsufficientFundsError(register.id, balance, withdrawalAmount)
}
```

The type/deposit/correction carve-out (`!isDepositType && type !== 'CORRECTION'`)
stays at the **caller**, because it depends on transfer _type_, which the caller
already has — keep the funds function about _funds_, not _type routing_.

### 4b. Enforcement point — the `beforeValidate` hook

Add the balance precondition to `validateTransfer` (`validate.ts`), after the
existing source-register resolution (`:54-61`), gated by the same
`needsSourceRegister` + withdrawal carve-out already modeled in
`transfer-rules.ts`. A hook throw halts the write before commit and covers app +
admin + API uniformly.

```ts
// inside validateTransfer, after sourceRegister is resolved
if (needsSourceRegister(type) && !isDepositType(type) && type !== 'CORRECTION') {
  const register = await loadRegister(sourceRegister)
  await assertSufficientFunds(req.payload, register, amount) // throws → halt
}
```

### 4c. App-path UX — keep the clean halt

The hook `throw` would surface to the server action as a rejected `payload.create`.
Wrap that in the action (`createTransferAction`, `createBulkTransferAction`) to map
`InsufficientFundsError` → `{ success: false, error }` (the existing
`ActionResultT` contract) so the form shows the message instead of a 500. Bulk:
pass the **summed** amount (`transfers.ts:102` pattern) — one check for the batch,
inside the existing DB transaction (`:113-147`) so a mid-batch failure rolls back.

### 4d. What we deliberately do NOT do

- No re-materialized `balance` column / no DB CHECK. The read-model design is
  intentional (`recalculate-balances.ts:16-18`); a CHECK can't express the
  AUXILIARY-only + withdrawal-only carve-outs anyway.
- No client-side block as the _primary_ guard (client stays advisory — the red
  "Saldo po transakcji"); the server is the source of truth.

---

## KROK 5 — Before / after, phases, tests

### Before → after per site

| Site                                     | Before                | After                                                |
| ---------------------------------------- | --------------------- | ---------------------------------------------------- |
| `validate-source-register.ts:51-65`      | commented-out guard   | deleted; logic moved to `assert-sufficient-funds.ts` |
| `transfers.ts:44-56`                     | commented block       | deleted; caller maps `InsufficientFundsError`→result |
| `transfers.ts:97-110` (bulk)             | commented block       | deleted; summed check inside the txn                 |
| `validate.ts`                            | no balance rule       | **new** precondition = the single guardian           |
| `transfers.ts:25`                        | `// TODO re-add` stub | real import of `assertSufficientFunds`               |
| `__tests__/action-utils.test.ts:129-191` | commented `describe`  | replaced by tests on the new function + hook         |

### Phased plan (test-first — repo has Vitest, honor its TDD discipline)

- **Phase 1 (test-first): the invariant function.** Red tests for
  `assertSufficientFunds`: AUXILIARY over-withdrawal throws `InsufficientFundsError`;
  exactly-equal balance passes; MAIN/VIRTUAL/WORKER never throw; deposit/correction
  never reach it. Then implement to green. Assert on the **thrown named error**, not
  a return flag.
- **Phase 2 (test-first): the hook enforcement.** Test that a `beforeValidate` run
  with an over-budget AUXILIARY withdrawal halts (throws) and **no row is
  persisted** — assert observable persisted state, not the action's return value
  (this is the exact trap the repo's testing rules call out). Covers the admin/API
  path the old action-level check missed.
- **Phase 3: action error mapping + bulk.** Map `InsufficientFundsError` →
  `{success:false,error}`; bulk summed check inside the transaction; test that a
  bulk exceeding balance rolls back **all** line items (assert count unchanged).
- **Phase 4: cleanup.** Delete the commented corpses (`validate-source-register.ts`,
  `transfers.ts` blocks, old test block); remove the TODO stub.

### Test cases for the invariant (legal / illegal)

- ILLEGAL: AUXILIARY, balance 100, INVESTMENT_EXPENSE 150 → throws.
- LEGAL: AUXILIARY, balance 150, expense 150 → passes (≥, not >).
- LEGAL: AUXILIARY, balance 0, INVESTOR_DEPOSIT 500 → passes (deposit skipped).
- LEGAL: AUXILIARY, balance 0, CORRECTION −50 → passes (correction skipped).
- LEGAL: VIRTUAL, balance −200, expense 999 → passes (type exempt).
- ILLEGAL (bulk): AUXILIARY, balance 100, line items [60, 60] → throws (sum 120),
  and zero rows persist.

### New load-bearing names to register (if the repo tracks contracts)

- `InsufficientFundsError` — the named domain error.
- `assertSufficientFunds` — the single enforcement function.
- Rule name: **"AUXILIARY-register sufficient-funds precondition"** — carve-outs
  (AUXILIARY-only, withdrawal-only) are part of the contract; a future reviewer
  must not "simplify" them away.

---

## Summary

I1 — an AUXILIARY register must not go negative — is the one invariant that is both
core to the cash-ledger domain and enforced by **zero** layers today; its guard
survives only as commented-out code and a TODO. Because balance is a derived SUM
with no stored column, a classic load-mutate-save aggregate doesn't fit; the
guardian is instead a single pure domain function (`assertSufficientFunds` throwing
a named `InsufficientFundsError`) enforced at one fail-fast choke point — the
`beforeValidate` hook — which, unlike the old action-only check, also covers
admin-panel and API writes. The plan preserves the two load-bearing carve-outs
(AUXILIARY-only, withdrawal-only skipping deposits/CORRECTION) as explicit
arguments rather than scattered `if`s, keeps the client advisory and the server
authoritative, and rolls out test-first in four phases with tests that assert
persisted state and thrown errors, not return flags. It deliberately avoids
re-materializing the balance column the schema intentionally dropped. Do this
before the kosztorys editor adds new surface area on top of the ledger.
