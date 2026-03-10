# Remove EMPLOYEE_EXPENSE — Workers as Cash Registers: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `EMPLOYEE_EXPENSE` and `ACCOUNT_FUNDING` transfer types by making workers into `WORKER`-type cash registers, unifying all money flow under the existing register balance system.

**Architecture:** Workers get a dedicated `WORKER` cash register (auto-created on employee creation). All worker expenses become standard `INVESTMENT_EXPENSE` or `OTHER` with `sourceRegister` = worker's register. Funding workers becomes `REGISTER_TRANSFER` to their register. Worker saldo = register balance.

**Tech Stack:** Next.js 16.1.6, Payload CMS 3.73.0, PostgreSQL (Neon), Zod 4, TanStack Form, Vitest

**Branch:** `feat/workers-as-registers` — NO pushes to main.

**Pre-migration:** Create DB dump before running migration.

**Design doc:** `docs/plans/2026-03-10-remove-employee-expense-design.md`

---

### Task 1: Branch Setup & Feature Database

**Step 1: Create feature branch**

```bash
git checkout -b feat/workers-as-registers
```

**Step 2: Start the feature database**

A second Postgres container (`db-feature`) runs on port 5434 with a separate volume. It's already defined in `docker-compose.yml`.

```bash
docker compose up -d db-feature
```

**Step 3: Import current data into feature DB**

```bash
docker exec -i wykonczymy-feature psql -U postgres -d wykonczymy-db < dump.sql
```

**Step 4: Point feature branch to the feature DB**

In `.env`, change the connection string:

```
DB_POSTGRES_URL='postgres://postgres:postgres@localhost:5434/wykonczymy-db'
```

This keeps `main` on port 5433 and the feature branch on port 5434 — both can run independently for comparison.

---

### Task 2: Add WORKER Register Type

**Files:**

- Modify: `src/collections/cash-registers.ts:54-58` (add WORKER option)
- Modify: `src/types/reference-data.ts:10` (add WORKER to CashRegisterTypeT)
- Modify: `src/collections/cash-registers.ts:6-9` (update enforceAuxiliaryForManager hook)

**Step 1: Add WORKER to collection type options**

In `src/collections/cash-registers.ts`, add the WORKER option to the `type` select field:

```ts
options: [
  { label: { en: 'Main', pl: 'Główna' }, value: 'MAIN' },
  { label: { en: 'Auxiliary', pl: 'Pomocnicza' }, value: 'AUXILIARY' },
  { label: { en: 'Virtual', pl: 'Wirtualna' }, value: 'VIRTUAL' },
  { label: { en: 'Worker', pl: 'Pracownicza' }, value: 'WORKER' },
],
```

**Step 2: Update enforceAuxiliaryForManager hook**

Managers should not be able to create WORKER registers via admin panel (system-only or admin/owner). Update the hook:

```ts
const enforceAuxiliaryForManager: CollectionBeforeValidateHook = ({ data, req }) => {
  if (isManager({ req })) return { ...data, type: 'AUXILIARY' }
  return data
}
```

No change needed — this already prevents managers from setting type to WORKER. They'll always get AUXILIARY.

**Step 3: Update CashRegisterTypeT in shared types**

In `src/types/reference-data.ts`, update the type:

```ts
export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL' | 'WORKER'
```

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (no consumers of the union type break from adding a member)

**Step 5: Commit**

```bash
git add src/collections/cash-registers.ts src/types/reference-data.ts
git commit -m "feat: add WORKER type to cash registers"
```

---

### Task 3: Auto-Create WORKER Register on Employee Creation

**Files:**

- Modify: `src/collections/users.ts` (add afterChange hook)

**Step 1: Read the current users collection config**

Check `src/collections/users.ts` for existing hooks and structure.

**Step 2: Add afterChange hook to auto-create WORKER register**

In `src/collections/users.ts`, add an `afterChange` hook:

```ts
import type { CollectionAfterChangeHook } from 'payload'

const autoCreateWorkerRegister: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  const isNewEmployee =
    (operation === 'create' && doc.role === 'EMPLOYEE') ||
    (operation === 'update' && doc.role === 'EMPLOYEE' && previousDoc?.role !== 'EMPLOYEE')

  if (!isNewEmployee) return doc

  // Check if WORKER register already exists for this user
  const existing = await req.payload.find({
    collection: 'cash-registers',
    where: {
      owner: { equals: doc.id },
      type: { equals: 'WORKER' },
    },
    limit: 1,
  })

  if (existing.docs.length > 0) return doc

  await req.payload.create({
    collection: 'cash-registers',
    data: {
      name: `Konto - ${doc.name}`,
      owner: doc.id,
      type: 'WORKER',
      active: true,
    },
  })

  return doc
}
```

Add to the collection config's hooks:

```ts
hooks: {
  afterChange: [autoCreateWorkerRegister],
},
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/collections/users.ts
git commit -m "feat: auto-create WORKER register on employee creation"
```

---

### Task 4: Add Type Filtering to CashRegisterField

**Files:**

- Modify: `src/components/forms/form-fields/cash-register-field.tsx`

**Step 1: Add optional type filtering props**

Add `includeTypes` and `excludeTypes` props to CashRegisterField. These filter the `cashRegisters` array before rendering.

```ts
type CashRegisterFieldPropsT = {
  // ... existing props
  includeTypes?: CashRegisterTypeT[]
  excludeTypes?: CashRegisterTypeT[]
}
```

**Step 2: Apply type filtering in the component**

Filter the cash registers list based on the new props, before the existing ownership/active filters:

```ts
let filtered = cashRegisters
if (includeTypes) {
  filtered = filtered.filter((cr) => includeTypes.includes(cr.type))
}
if (excludeTypes) {
  filtered = filtered.filter((cr) => !excludeTypes.includes(cr.type))
}
// ... then apply existing ownership/active filters
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/components/forms/form-fields/cash-register-field.tsx
git commit -m "feat: add type filtering to CashRegisterField"
```

---

### Task 5: Update Transfer Constants

**Files:**

- Modify: `src/lib/constants/transfers.ts`
- Modify: `src/__tests__/transfer-constants.test.ts`

**Step 1: Write updated tests first**

Update `src/__tests__/transfer-constants.test.ts`:

- Remove EMPLOYEE_EXPENSE and ACCOUNT_FUNDING from all truth tables
- Remove WORKER_SALDO_TYPES tests
- Remove needsWorker() tests
- Update TRANSACTION_TRANSFER_TYPES to exclude ACCOUNT_FUNDING
- Update COST_TYPES to exclude EMPLOYEE_EXPENSE
- Update needsSourceRegister() — no longer excludes EMPLOYEE_EXPENSE (it doesn't exist)
- Update needsOtherCategory() — only OTHER
- Update showsInvestment() — remove EMPLOYEE_EXPENSE
- Update needsExpenseCategory() — only INVESTMENT_EXPENSE (already correct)

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/transfer-constants.test.ts
```

Expected: FAIL (old types still present)

**Step 3: Update constants file**

In `src/lib/constants/transfers.ts`:

Remove from `TRANSFER_TYPES`:

- `'EMPLOYEE_EXPENSE'`
- `'ACCOUNT_FUNDING'`

Remove from `TRANSFER_TYPE_LABELS`:

- `EMPLOYEE_EXPENSE: 'Wydatek pracowniczy'`
- `ACCOUNT_FUNDING: 'Zasilenie konta współpracownika'`

Remove from `TRANSACTION_TRANSFER_TYPES`:

- `'ACCOUNT_FUNDING'`

Update `COST_TYPES`:

```ts
export const COST_TYPES: TransferTypeT[] = ['INVESTMENT_EXPENSE', 'LABOR_COST']
```

Remove entirely:

- `WORKER_SALDO_TYPES`
- `needsWorker()`

Update `needsSourceRegister`:

```ts
export const needsSourceRegister = (type: string) => isTransferType(type) && type !== 'LABOR_COST'
```

Update `needsOtherCategory`:

```ts
export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'
```

Update `showsInvestment` — remove EMPLOYEE_EXPENSE (it was in COST_TYPES which feeds INVESTMENT_TYPES, so just updating COST_TYPES handles it).

**Step 4: Run tests**

```bash
pnpm test -- src/__tests__/transfer-constants.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/constants/transfers.ts src/__tests__/transfer-constants.test.ts
git commit -m "feat: remove EMPLOYEE_EXPENSE and ACCOUNT_FUNDING from constants"
```

---

### Task 6: Update Transfers Collection Config

**Files:**

- Modify: `src/collections/transfers.ts`

**Step 1: Remove types from select options**

Remove these from the `TRANSFER_TYPES` array (lines 6-24):

- `EMPLOYEE_EXPENSE` entry
- `ACCOUNT_FUNDING` entry

**Step 2: Update conditional visibility helpers**

```ts
/** Show sourceRegister for all types except LABOR_COST */
const showSourceRegister = (data: Record<string, unknown>) => data?.type !== 'LABOR_COST'

/** Show investment field for types that use it */
const showInvestment = (data: Record<string, unknown>) =>
  data?.type === 'INVESTOR_DEPOSIT' ||
  data?.type === 'INVESTMENT_EXPENSE' ||
  data?.type === 'LABOR_COST'

/** Show field when type is OTHER */
const needsOtherCategory = (data: Record<string, unknown>) => data?.type === 'OTHER'

/** Show expenseCategory for INVESTMENT_EXPENSE */
const showExpenseCategory = (data: Record<string, unknown>) => data?.type === 'INVESTMENT_EXPENSE'
```

Remove entirely:

- `needsWorker` helper function

**Step 3: Remove worker field admin condition or remove the field**

The `worker` field (lines 173-181) — keep it in the collection for now (existing data references it), but remove the `admin.condition` so it's always hidden in Payload admin. Or set condition to `() => false`.

```ts
{
  name: 'worker',
  type: 'relationship',
  relationTo: 'users',
  label: { en: 'Worker', pl: 'Pracownik' },
  access: { update: () => false },
  admin: {
    condition: () => false,
  },
},
```

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: May have errors from files still importing `needsWorker` — these will be fixed in subsequent tasks.

**Step 5: Commit**

```bash
git add src/collections/transfers.ts
git commit -m "feat: remove EMPLOYEE_EXPENSE and ACCOUNT_FUNDING from transfers collection"
```

---

### Task 7: Update Validation Hook

**Files:**

- Modify: `src/hooks/transfers/validate.ts`
- Modify: `src/__tests__/validate-hook.test.ts`

**Step 1: Update tests first**

In `src/__tests__/validate-hook.test.ts`:

- Remove all EMPLOYEE_EXPENSE test payloads from VALID_DATA
- Remove all ACCOUNT_FUNDING test payloads from VALID_DATA
- Remove all test cases for:
  - Register refund detection
  - EMPLOYEE_EXPENSE auto-clear sourceRegister
  - EMPLOYEE_EXPENSE requires investment OR otherCategory
  - EMPLOYEE_EXPENSE expenseCategory required with investment
  - Worker required for EMPLOYEE_EXPENSE/ACCOUNT_FUNDING
- Keep tests for remaining types (INVESTMENT_EXPENSE, OTHER, LABOR_COST, etc.)

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/validate-hook.test.ts
```

**Step 3: Simplify the validation hook**

In `src/hooks/transfers/validate.ts`, remove:

- Register refund detection logic (lines 39-41)
- `sourceRegister` auto-clear for EMPLOYEE_EXPENSE (lines 50-52)
- Worker requirement for EMPLOYEE_EXPENSE/ACCOUNT_FUNDING (line 60 area)
- EMPLOYEE_EXPENSE requires investment OR otherCategory (lines 88-98)
- expenseCategory required for EMPLOYEE_EXPENSE with investment
- All references to EMPLOYEE_EXPENSE and ACCOUNT_FUNDING

Keep:

- `createdBy` auto-set
- CANCELLATION skip logic
- Remaining type validations (INVESTMENT_EXPENSE needs investment, OTHER needs otherCategory, etc.)
- sourceRegister/targetRegister validations for remaining types

**Step 4: Run tests**

```bash
pnpm test -- src/__tests__/validate-hook.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/transfers/validate.ts src/__tests__/validate-hook.test.ts
git commit -m "feat: remove EMPLOYEE_EXPENSE logic from validation hook"
```

---

### Task 8: Update SQL Balance Queries

**Files:**

- Modify: `src/lib/db/sum-transfers.ts`
- Modify: `src/__tests__/sum-transfers.test.ts`

**Step 1: Update tests first**

In `src/__tests__/sum-transfers.test.ts`:

- Remove `deriveWorkerBreakdown()` tests entirely
- Update `deriveFinancials()` tests: `totalMaterialCosts` no longer includes EMPLOYEE_EXPENSE (only INVESTMENT_EXPENSE)
- Remove any test payloads using EMPLOYEE_EXPENSE or ACCOUNT_FUNDING types

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/sum-transfers.test.ts
```

**Step 3: Update the SQL functions**

In `src/lib/db/sum-transfers.ts`:

**sumRegisterBalance()** (line 37): Remove `EMPLOYEE_EXPENSE` from deposit types CASE WHEN:

```sql
CASE
  WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT')
    THEN amount
  ELSE -amount
END
```

**sumAllRegisterBalances()** (line 70): Same change — remove `EMPLOYEE_EXPENSE` from deposit CASE.

**sumAllInvestmentFinancials()** (lines 129, 143): Remove `EMPLOYEE_EXPENSE` from type IN clauses:

```sql
-- Was: CASE WHEN type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
CASE WHEN type IN ('INVESTMENT_EXPENSE')
```

**Remove entirely:**

- `sumAllWorkerSaldos()` function (lines 183-205)
- `deriveWorkerBreakdown()` function (lines 282-286)

**deriveFinancials()**: Update `totalMaterialCosts` — only sums `INVESTMENT_EXPENSE` (already handled by removing from SQL).

**Step 4: Run tests**

```bash
pnpm test -- src/__tests__/sum-transfers.test.ts
```

Expected: PASS

**Step 5: Run typecheck** (other files may reference removed functions)

```bash
pnpm typecheck
```

Note: `sumAllWorkerSaldos` and `deriveWorkerBreakdown` may be imported elsewhere — fix those in subsequent tasks.

**Step 6: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "feat: remove worker saldo SQL, clean EMPLOYEE_EXPENSE from balance queries"
```

---

### Task 9: Update Dashboard Queries

**Files:**

- Modify: `src/lib/queries/dashboard.ts`

**Step 1: Remove worker saldo fetching**

In `src/lib/queries/dashboard.ts`:

- Remove import of `sumAllWorkerSaldos` (or `fetchWorkerSaldos`)
- Remove the saldo fetch call
- For the workers view: fetch worker saldo from their WORKER register balance instead

The workers section should now:

1. Fetch all users with role=EMPLOYEE
2. For each, find their WORKER register
3. Use register balance as saldo (from `sumAllRegisterBalances()` which already exists)

Or simpler: fetch all WORKER registers with their balances — the register `owner` field tells you who the worker is.

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/lib/queries/dashboard.ts
git commit -m "feat: use register balance for worker saldo in dashboard"
```

---

### Task 10: Rewrite Settlement Schema

**Files:**

- Modify: `src/components/forms/settlement-form/settlement-schema.ts`
- Modify: `src/__tests__/settlement-schema.test.ts`

**Step 1: Update tests first**

In `src/__tests__/settlement-schema.test.ts`:

- Replace `worker` field with `workerRegister` (cash register ID of WORKER type)
- Update expected types:
  - Investment mode → type: `INVESTMENT_EXPENSE`
  - Category mode → type: `OTHER`
  - Register mode → type: `REGISTER_TRANSFER`
- Register mode now needs `targetRegister` (physical register receiving money)
- Remove `worker` from all payloads

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/settlement-schema.test.ts
```

**Step 3: Rewrite the schema**

Key changes to `settlement-schema.ts`:

- Replace `worker` field with `workerRegister` (number, required)
- Investment mode: validates `investment` + `expenseCategory` required
- Category mode: validates `otherCategory` required
- Register mode: validates `targetRegister` required (the physical register)
- All modes: `sourceRegister` is implicitly the `workerRegister`

**Step 4: Run tests**

```bash
pnpm test -- src/__tests__/settlement-schema.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/forms/settlement-form/settlement-schema.ts src/__tests__/settlement-schema.test.ts
git commit -m "feat: rewrite settlement schema for worker registers"
```

---

### Task 11: Rewrite Settlement Actions

**Files:**

- Modify: `src/lib/actions/settlements.ts`
- Modify: `src/__tests__/settlement-actions.test.ts`

**Step 1: Update tests first**

In `src/__tests__/settlement-actions.test.ts`:

- Replace `worker` with `workerRegister` in all test payloads
- Investment mode: expect `payload.create()` called with `type: 'INVESTMENT_EXPENSE'`, `sourceRegister: workerRegisterId`
- Category mode: expect `type: 'OTHER'`, `sourceRegister: workerRegisterId`
- Register mode: expect `type: 'REGISTER_TRANSFER'`, `sourceRegister: workerRegisterId`, `targetRegister: physicalRegisterId`
- Remove `getManagementEmployeeSaldo()` tests

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/settlement-actions.test.ts
```

**Step 3: Rewrite settlement actions**

In `src/lib/actions/settlements.ts`:

**Register refund mode** (was creating EMPLOYEE_EXPENSE with sourceRegister):

```ts
await payload.create({
  collection: 'transactions',
  data: {
    type: 'REGISTER_TRANSFER',
    sourceRegister: parsed.data.workerRegister, // worker's register
    targetRegister: parsed.data.targetRegister, // physical register
    amount: parsed.data.amount,
    description: parsed.data.description,
    date: parsed.data.date,
    paymentMethod: 'CASH',
  },
})
```

**Investment mode** (was creating EMPLOYEE_EXPENSE with investment):

```ts
await payload.create({
  collection: 'transactions',
  data: {
    type: 'INVESTMENT_EXPENSE',
    sourceRegister: parsed.data.workerRegister,
    investment: item.investment,
    expenseCategory: item.expenseCategory,
    amount: item.amount,
    description: item.description,
    date: parsed.data.date,
    paymentMethod: 'CASH',
  },
})
```

**Category mode** (was creating EMPLOYEE_EXPENSE with otherCategory):

```ts
await payload.create({
  collection: 'transactions',
  data: {
    type: 'OTHER',
    sourceRegister: parsed.data.workerRegister,
    otherCategory: item.otherCategory,
    otherDescription: item.otherDescription,
    amount: item.amount,
    description: item.description,
    date: parsed.data.date,
    paymentMethod: 'CASH',
  },
})
```

**Remove `getManagementEmployeeSaldo()`** — worker saldo is now just the WORKER register balance, fetched via `sumRegisterBalance(workerRegisterId)`.

**Step 4: Run tests**

```bash
pnpm test -- src/__tests__/settlement-actions.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/actions/settlements.ts src/__tests__/settlement-actions.test.ts
git commit -m "feat: rewrite settlement actions for worker registers"
```

---

### Task 12: Rewrite Settlement Form UI

**Files:**

- Modify: `src/components/forms/settlement-form/settlement-form.tsx`
- Modify: `src/components/dialogs/add-settlement-dialog.tsx`

**Step 1: Update AddSettlementDialog**

In `src/components/dialogs/add-settlement-dialog.tsx`:

- Remove worker filtering logic
- Filter cash registers to show only `WORKER` type:

```ts
cashRegisters: referenceData.cashRegisters.filter((cr) => cr.type === 'WORKER')
```

- Remove `defaultCashRegisterId` worker logic (no longer relevant)

**Step 2: Rewrite SettlementForm**

Key changes to `settlement-form.tsx`:

- Replace `WorkerField` with `CashRegisterField` filtered to `includeTypes={['WORKER']}`
- The selected register IS the worker — no separate worker selection
- Saldo display: fetch register balance via `sumRegisterBalance(workerRegisterId)` instead of `getManagementEmployeeSaldo()`
- Register mode: add `targetRegister` field (CashRegisterField for physical registers, `excludeTypes={['WORKER']}`)
- Remove all references to `worker` field
- Update form submission to pass `workerRegister` instead of `worker`

**Step 3: Run typecheck and dev server**

```bash
pnpm typecheck
pnpm dev
```

Manually verify the settlement dialog opens and shows worker registers.

**Step 4: Commit**

```bash
git add src/components/forms/settlement-form/settlement-form.tsx src/components/dialogs/add-settlement-dialog.tsx
git commit -m "feat: rewrite settlement form to use worker registers"
```

---

### Task 13: Update Transfer Form

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx`
- Modify: `src/components/forms/transfer-form/transfer-schema.ts`
- Modify: `src/__tests__/transfer-schema.test.ts`

**Step 1: Update tests first**

In `src/__tests__/transfer-schema.test.ts`:

- Remove all EMPLOYEE_EXPENSE test cases (valid payloads, missing field tests, investment vs otherCategory tests)
- Remove all ACCOUNT_FUNDING test cases
- Remove worker field validation tests

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/transfer-schema.test.ts
```

**Step 3: Update transfer-schema.ts**

- Remove EMPLOYEE_EXPENSE and ACCOUNT_FUNDING from validation rules in `transferFieldRules`
- Remove worker field requirement
- Remove EMPLOYEE_EXPENSE investment-vs-otherCategory rule
- Remove EMPLOYEE_EXPENSE expenseCategory rule

**Step 4: Update transfer-form.tsx**

- Remove import of `needsWorker` (no longer exists)
- Remove `isAccountFunding` variable and its conditional rendering (single amount field)
- Remove EMPLOYEE_EXPENSE radio toggle (lines 198-233)
- Remove `expenseTarget` state variable
- Remove worker field rendering (line 292)
- Simplify conditional fields — no more EMPLOYEE_EXPENSE branches
- Add `excludeTypes={['WORKER']}` to the source register CashRegisterField

**Step 5: Run tests**

```bash
pnpm test -- src/__tests__/transfer-schema.test.ts
```

Expected: PASS

**Step 6: Run typecheck**

```bash
pnpm typecheck
```

**Step 7: Commit**

```bash
git add src/components/forms/transfer-form/ src/__tests__/transfer-schema.test.ts
git commit -m "feat: remove EMPLOYEE_EXPENSE and ACCOUNT_FUNDING from transfer form"
```

---

### Task 14: Update Register Transfer Form & Dialog

**Files:**

- Modify: `src/components/forms/register-transfer-form/register-transfer-form.tsx`

**Step 1: Allow WORKER registers in target dropdown**

The register transfer form currently shows all registers in both source and target dropdowns. Update:

- Source register: `excludeTypes={['WORKER']}` — you don't transfer FROM a worker register here (that's what settlement is for)
- Target register: keep all types including WORKER — this is how you fund a worker

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/components/forms/register-transfer-form/register-transfer-form.tsx
git commit -m "feat: allow WORKER registers as transfer targets for funding"
```

---

### Task 15: Update Remaining UI Components

**Files:**

- Modify: `src/components/transfers/transfer-filters.tsx` (if it renders EMPLOYEE_EXPENSE/ACCOUNT_FUNDING in dropdown)
- Modify: `src/components/forms/deposit-form/deposit-form.tsx` (add WORKER register exclusion if needed)
- Modify: `src/lib/tables/transfers.tsx` (keep worker column for backward compat, no changes needed)

**Step 1: Update transfer filters**

In `src/components/transfers/transfer-filters.tsx`:

The type filter uses `TRANSFER_TYPES` from constants — since we already removed EMPLOYEE_EXPENSE and ACCOUNT_FUNDING from that array in Task 5, this should auto-resolve. Verify.

**Step 2: Update deposit form**

In `src/components/forms/deposit-form/deposit-form.tsx`:

Add `excludeTypes={['WORKER']}` to the CashRegisterField — deposits go to physical registers, not worker accounts.

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/components/transfers/transfer-filters.tsx src/components/forms/deposit-form/deposit-form.tsx
git commit -m "feat: filter WORKER registers from deposit and transfer filter UI"
```

---

### Task 16: Write Database Migration

**IMPORTANT:** PostgreSQL cannot use a new enum value in the same transaction where it was added via `ALTER TYPE ADD VALUE`. The migration MUST be split into two files.

**Files:**

- Create: `src/migrations/20260310_0_add_worker_register_type.ts` (enum only)
- Create: `src/migrations/20260310_workers_as_registers.ts` (data migration)
- Modify: `src/migrations/index.ts` (register both, enum first)

**Step 1: Create enum migration** (`20260310_0_add_worker_register_type.ts`)

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE enum_cash_registers_type ADD VALUE IF NOT EXISTS 'WORKER';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE cash_registers SET type = 'AUXILIARY' WHERE type = 'WORKER';
    ALTER TYPE enum_cash_registers_type RENAME TO enum_cash_registers_type_old;
    CREATE TYPE enum_cash_registers_type AS ENUM ('MAIN', 'AUXILIARY', 'VIRTUAL');
    ALTER TABLE cash_registers
      ALTER COLUMN type TYPE enum_cash_registers_type
      USING type::text::enum_cash_registers_type;
    DROP TYPE enum_cash_registers_type_old;
  `)
}
```

**Step 2: Create data migration** (`20260310_workers_as_registers.ts`)

The data migration handles:

1. Create WORKER register per employee who has transactions
2. Migrate ACCOUNT_FUNDING → REGISTER_TRANSFER (source stays, target = worker register)
3. Migrate EMPLOYEE_EXPENSE with investment → INVESTMENT_EXPENSE (source = worker register)
4. Migrate EMPLOYEE_EXPENSE with otherCategory → OTHER (source = worker register)
5. Migrate EMPLOYEE_EXPENSE refunds → REGISTER_TRANSFER (swap source/target)
6. Verify no old types remain (throws if any found)

**Step 3: Register both in migrations index**

The enum migration MUST come before the data migration in the array.

**Step 4: Run migration**

```bash
pnpm payload migrate
```

**Step 5: Verify data integrity**

```sql
-- Verify WORKER registers created
SELECT name, owner_id, type FROM cash_registers WHERE type = 'WORKER' ORDER BY owner_id;

-- Verify no old types remain
SELECT type, COUNT(*) FROM transactions WHERE type IN ('EMPLOYEE_EXPENSE', 'ACCOUNT_FUNDING') GROUP BY type;
-- Should return 0 rows

-- Check worker register balances
SELECT cr.name, cr.owner_id,
  COALESCE(SUM(
    CASE
      WHEN type IN ('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT') THEN amount
      ELSE -amount
    END
  ), 0) AS balance
FROM transactions t
JOIN cash_registers cr ON cr.id = t.source_register_id
WHERE cr.type = 'WORKER' AND t.cancelled IS NOT TRUE
GROUP BY cr.id, cr.name, cr.owner_id;
```

**Step 6: Commit**

```bash
git add src/migrations/
git commit -m "feat: migration to convert workers to WORKER registers"
```

---

### Task 17: Final Cleanup & Verification

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: ALL PASS

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS

**Step 3: Run lint**

```bash
pnpm lint
```

**Step 4: Run dev server and smoke test**

```bash
pnpm dev
```

Manually verify:

- Settlement dialog shows worker registers (not workers)
- Settlement creates correct transfer types
- Register transfer dialog shows worker registers in target
- Transfer dialog does NOT show EMPLOYEE_EXPENSE or ACCOUNT_FUNDING
- Deposit dialog does NOT show worker registers
- Worker register balances display correctly
- Investment financials still correct

**Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```

---

### Task Order & Dependencies

```
Task 1 (branch + dump)
  → Task 2 (WORKER register type)
  → Task 3 (auto-create hook)
  → Task 4 (CashRegisterField filtering)
  → Task 5 (constants) ─────────────────────┐
  → Task 6 (transfers collection)            │
  → Task 7 (validation hook)                 │ All depend on
  → Task 8 (SQL queries)                     │ constants being
  → Task 9 (dashboard queries)               │ updated first
  → Task 10 (settlement schema) ─────────────┤
  → Task 11 (settlement actions)             │
  → Task 12 (settlement form UI)             │
  → Task 13 (transfer form) ─────────────────┘
  → Task 14 (register transfer form)
  → Task 15 (remaining UI)
  → Task 16 (DB migration)
  → Task 17 (final verification)
```

Tasks 2-4 can run in parallel (independent).
Tasks 5-9 should be sequential (each builds on previous).
Tasks 10-12 are sequential (schema → actions → UI).
Tasks 13-15 can run after Task 5.
Task 16 (migration) should run after all code changes.
Task 17 is always last.
