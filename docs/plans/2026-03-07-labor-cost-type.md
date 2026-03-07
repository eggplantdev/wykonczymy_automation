# LABOR_COST Transfer Type Implementation Plan

> **Status:** COMPLETED — all tasks implemented, 590 tests passing, PR #3 open.

**Goal:** Add `LABOR_COST` transfer type tied to investments, replacing the static `laborCosts` field on investments with real transaction-derived data.

**Architecture:** New transfer type follows `EMPLOYEE_EXPENSE` pattern (no source register) but simpler — only requires investment. Static `laborCosts` column removed from investments, replaced by SQL aggregation from `LABOR_COST` transactions. `InvestmentFinancialsT` extended with `totalLaborCosts` field.

**Tech Stack:** Next.js 16, Payload CMS, Zod 4, Vitest, raw SQL aggregation

---

## Task 1: Constants & Predicates

**Files:**

- Modify: `src/lib/constants/transfers.ts`
- Modify: `src/__tests__/transfer-constants.test.ts`

Add `LABOR_COST` to:

- `TRANSFER_TYPES` (sorted alphabetically by Polish label: "Koszty robocizny" between "Inne" and "Transfer między kasami")
- `TRANSFER_TYPE_LABELS`: `'Koszty robocizny'`
- `TRANSACTION_TRANSFER_TYPES` (sorted: between "Inne" and "Wydatek inwestycyjny")
- `COST_TYPES`, `INVESTMENT_TYPES`

Update predicates:

- `needsSourceRegister` → false for `LABOR_COST`
- `showsInvestment` → true for `LABOR_COST`
- `requiresInvestment` → true for `LABOR_COST`

Update tests: truth table, TRANSACTION_TRANSFER_TYPES assertion, edge cases.

---

## Task 2: Payload Collection + Validation

**Files:**

- Modify: `src/collections/transfers.ts`
- Modify: `src/hooks/transfers/validate.ts`
- Modify: `src/__tests__/validate-hook.test.ts`

Add `LABOR_COST` option to collection type select. Update `showSourceRegister`, `showInvestment` conditions. Validate: requires investment, no source register, no worker, no category. Update validate hook tests.

---

## Task 3: Schema & Server Action

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-schema.ts`
- Modify: `src/lib/actions/transfers.ts`
- Modify: `src/__tests__/transfer-schema.test.ts`

Schema validation already uses predicates — just update tests. Fix `createTransferAction` line 33: change `!isDepositType` check to also skip source register validation for types that don't need it (use `needsSourceRegister` instead).

---

## Task 4: SQL Aggregation

**Files:**

- Modify: `src/lib/db/sum-transfers.ts`
- Modify: `src/types/reference-data.ts`

Add `LABOR_COST` to `sumInvestmentCosts` and `sumAllInvestmentFinancials`. Extend `InvestmentFinancialsT` with `totalLaborCosts`. Update the SQL to compute labor costs as a separate column.

---

## Task 5: Remove Static `laborCosts` + Update Consumers

**Files:**

- Modify: `src/collections/investments.ts` — remove `laborCosts` field
- Modify: `src/lib/queries/reference-data.ts` — remove `labor_costs` from SQL + mapping
- Modify: `src/types/reference-data.ts` — remove `laborCosts` from `InvestmentRefT`
- Modify: `src/lib/queries/dashboard.ts` — use `fin.totalLaborCosts` instead of `inv.laborCosts`
- Modify: `src/lib/tables/investments.tsx` — remove `laborCosts` from `InvestmentRowT`
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx` — use computed labor costs from financials
- Modify: `src/__tests__/dashboard-aggregation.test.ts` — update mock data and assertions
- Modify: `src/__tests__/transfer-table.test.ts` — remove `laborCosts` from mock
- Create: migration to drop `labor_costs` column

---

## Task 6: Future Improvements Doc

**Files:**

- Modify: `docs/plans/future-improvements.md`

Add entry for dynamic filter-aware stat cards (sum of currently filtered transactions).

---

## Reference: LABOR_COST Behavior Matrix

| Property                 | Value               |
| ------------------------ | ------------------- |
| needsSourceRegister      | false               |
| requiresInvestment       | true                |
| showsInvestment          | true                |
| needsWorker              | false               |
| needsTargetRegister      | false               |
| needsOtherCategory       | false               |
| Counts as cost           | yes (COST_TYPES)    |
| Affects register balance | no                  |
| Affects worker saldo     | no                  |
| Affects investment costs | yes (separate line) |
