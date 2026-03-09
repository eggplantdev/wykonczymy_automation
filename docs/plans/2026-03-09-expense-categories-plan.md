# Expense Categories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-category cost breakdown for investment expenses, with dynamic stat cards on investment and reports pages.

**Architecture:** New `expense-categories` Payload collection (like `other-categories`). New `expenseCategory` relationship field on transactions. SQL queries return per-category totals. Investment/reports pages render dynamic stat cards from category data. Forms show expense category selector for investment-related expenses.

**Tech Stack:** Payload CMS 3.73, PostgreSQL, TanStack React Table, TanStack React Form, Zod, Zustand, Recharts

**Design doc:** `docs/plans/2026-03-09-expense-categories-design.md`

---

### Task 1: Create branch + expense-categories collection

**Files:**

- Create: `src/collections/expense-categories.ts`
- Modify: `src/payload.config.ts:14-19,56`
- Modify: `src/seed.ts:10,27-36`

**Step 1: Create branch**

```bash
git checkout -b feat/expense-categories
```

**Step 2: Create the collection**

Create `src/collections/expense-categories.ts`:

```typescript
import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

export const ExpenseCategories: CollectionConfig = {
  slug: 'expense-categories',
  labels: {
    singular: { en: 'Expense Category', pl: 'Kategoria wydatku' },
    plural: { en: 'Expense Categories', pl: 'Kategorie wydatków' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('expenseCategories')],
    afterDelete: [makeRevalidateAfterDelete('expenseCategories')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
  ],
}
```

**Step 3: Register in payload config**

In `src/payload.config.ts`:

- Add import: `import { ExpenseCategories } from '@/collections/expense-categories'`
- Add to collections array: `[Users, CashRegisters, Investments, Transfers, OtherCategories, ExpenseCategories, Media]`

**Step 4: Add seed data**

In `src/seed.ts`:

- Add constant: `const SEED_EXPENSE_CATEGORIES = ['Materiały budowlane', 'Materiały wykończeniowe'] as const`
- Add seed function (copy `seedOtherCategories` pattern, use collection `'expense-categories'`)
- Call it from `seed()` after `seedOtherCategories(payload)`

**Step 5: Add cache tag**

In `src/lib/cache/tags.ts` add: `expenseCategories: 'collection:expense-categories',`

**Step 6: Commit**

```bash
git add src/collections/expense-categories.ts src/payload.config.ts src/seed.ts src/lib/cache/tags.ts
git commit -m "feat: add expense-categories collection with seed data"
```

---

### Task 2: Reference data + types

**Files:**

- Modify: `src/types/reference-data.ts:27-37`
- Modify: `src/lib/queries/reference-data.ts:18-24,26-107`

**Step 1: Add type**

In `src/types/reference-data.ts`:

- Add after `OtherCategoryRefT`: `export type ExpenseCategoryRefT = { readonly id: number; readonly name: string }`
- Add to `ReferenceDataBaseT`: `expenseCategories: ExpenseCategoryRefT[]`
- Add `ExpenseCategoryRefT` to the import list in `reference-data.ts`

**Step 2: Fetch in reference data**

In `src/lib/queries/reference-data.ts`:

- Add `CACHE_TAGS.expenseCategories` to the `cacheTag()` call (line 33)
- Add 5th parallel query: `db.execute(sql\`SELECT id, name FROM expense_categories ORDER BY name\`)`
- Map rows to `ExpenseCategoryRefT[]` (same pattern as `otherCategories`)
- Add to return: `{ cashRegisters, investments, workers, otherCategories, expenseCategories }`
- Update `totalRows` calculation to include new result

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

This will fail because `buildTransferLookups` and other consumers of `ReferenceDataBaseT` don't know about the new field yet. That's expected — we fix it in later tasks.

**Step 4: Commit**

```bash
git add src/types/reference-data.ts src/lib/queries/reference-data.ts
git commit -m "feat: add expenseCategories to reference data types and fetching"
```

---

### Task 3: Database migration + new field on transfers

**Files:**

- Create: `src/migrations/YYYYMMDD_add_expense_categories.ts` (use actual date)
- Modify: `src/collections/transfers.ts:38-42,149-158`

**Step 1: Create migration**

```bash
pnpm migrate:create add_expense_categories
```

Then edit the generated file with this SQL:

```typescript
import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Create expense_categories table
  await db.execute({
    sql: `
      CREATE TABLE IF NOT EXISTS "expense_categories" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" varchar NOT NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_name_idx" ON "expense_categories" ("name");
      CREATE INDEX IF NOT EXISTS "expense_categories_updated_at_idx" ON "expense_categories" ("updated_at");
      CREATE INDEX IF NOT EXISTS "expense_categories_created_at_idx" ON "expense_categories" ("created_at");
    `,
  })

  // 2. Seed initial categories
  await db.execute({
    sql: `
      INSERT INTO expense_categories (name, updated_at, created_at)
      VALUES ('Materiały budowlane', NOW(), NOW()),
             ('Materiały wykończeniowe', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `,
  })

  // 3. Add expense_category_id column to transactions
  await db.execute({
    sql: `
      ALTER TABLE "transactions"
      ADD COLUMN "expense_category_id" integer
      REFERENCES "expense_categories"("id") ON DELETE SET NULL;

      CREATE INDEX "transactions_expense_category_idx"
      ON "transactions" ("expense_category_id");
    `,
  })

  // 4. Backfill existing INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE (with investment) rows
  await db.execute({
    sql: `
      UPDATE transactions
      SET expense_category_id = (SELECT id FROM expense_categories WHERE name = 'Materiały budowlane')
      WHERE type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
        AND investment_id IS NOT NULL
        AND expense_category_id IS NULL;
    `,
  })
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute({
    sql: `
      ALTER TABLE "transactions" DROP COLUMN IF EXISTS "expense_category_id";
      DROP TABLE IF EXISTS "expense_categories";
    `,
  })
}
```

**Step 2: Add field to transfers collection**

In `src/collections/transfers.ts`:

Add a new `showExpenseCategory` condition function:

```typescript
/** Show expenseCategory for investment-related expense types */
const showExpenseCategory = (data: Record<string, unknown>) =>
  data?.type === 'INVESTMENT_EXPENSE' || (data?.type === 'EMPLOYEE_EXPENSE' && !!data?.investment)
```

Add field after the `investment` field (after line 158):

```typescript
{
  name: 'expenseCategory',
  type: 'relationship',
  relationTo: 'expense-categories',
  label: { en: 'Expense Category', pl: 'Kategoria wydatku' },
  access: { update: () => false },
  admin: {
    condition: (data) => showExpenseCategory(data),
  },
},
```

**Step 3: Regenerate types**

```bash
pnpm generate:types
```

**Step 4: Commit**

```bash
git add src/migrations/ src/collections/transfers.ts src/payload-types.ts
git commit -m "feat: add expense_categories table, field on transfers, backfill migration"
```

---

### Task 4: Constants + validation

**Files:**

- Modify: `src/lib/constants/transfers.ts` (add predicate)
- Modify: `src/hooks/transfers/validate.ts:54-57`
- Test: `src/__tests__/transfer-constants.test.ts`
- Test: `src/__tests__/validate-hook.test.ts`

**Step 1: Write failing tests for the new predicate**

In `src/__tests__/transfer-constants.test.ts`, add a new test case to the describe block:

```typescript
{
  name: 'needsExpenseCategory',
  fn: needsExpenseCategory,
  trueFor: ['INVESTMENT_EXPENSE'],
}
```

Note: `needsExpenseCategory` only checks by type alone — `EMPLOYEE_EXPENSE` needs it conditionally (when investment is set), which is handled in the validation hook, not the type predicate.

In `src/__tests__/validate-hook.test.ts`, add:

```typescript
it('INVESTMENT_EXPENSE without expenseCategory → throws', () => {
  const data = { ...VALID_DATA.INVESTMENT_EXPENSE, expenseCategory: undefined }
  expect(() => runValidate(data)).toThrow('Expense category is required')
})

it('INVESTMENT_EXPENSE with expenseCategory → passes', () => {
  const data = { ...VALID_DATA.INVESTMENT_EXPENSE, expenseCategory: 1 }
  expect(() => runValidate(data)).not.toThrow()
})

it('EMPLOYEE_EXPENSE with investment but no expenseCategory → throws', () => {
  const data = { ...VALID_DATA.EMPLOYEE_EXPENSE, expenseCategory: undefined }
  expect(() => runValidate(data)).toThrow('Expense category is required')
})

it('EMPLOYEE_EXPENSE with investment + expenseCategory → passes', () => {
  const data = { ...VALID_DATA.EMPLOYEE_EXPENSE, expenseCategory: 1 }
  expect(() => runValidate(data)).not.toThrow()
})
```

Also update `VALID_DATA.INVESTMENT_EXPENSE` and `VALID_DATA.EMPLOYEE_EXPENSE` to include `expenseCategory: 1`.

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/transfer-constants.test.ts src/__tests__/validate-hook.test.ts
```

**Step 3: Implement the predicate**

In `src/lib/constants/transfers.ts`, add:

```typescript
export const needsExpenseCategory = (type: string) =>
  isTransferType(type) && type === 'INVESTMENT_EXPENSE'
```

**Step 4: Update validation hook**

In `src/hooks/transfers/validate.ts`, after the investment check (line 57), add:

```typescript
// expenseCategory — required for INVESTMENT_EXPENSE, and EMPLOYEE_EXPENSE with investment
if (
  (type === 'INVESTMENT_EXPENSE' || (type === 'EMPLOYEE_EXPENSE' && !!d.investment)) &&
  !d.expenseCategory
) {
  errors.push('Expense category is required for investment-related expenses.')
}
```

**Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/__tests__/transfer-constants.test.ts src/__tests__/validate-hook.test.ts
```

**Step 6: Commit**

```bash
git add src/lib/constants/transfers.ts src/hooks/transfers/validate.ts src/__tests__/transfer-constants.test.ts src/__tests__/validate-hook.test.ts
git commit -m "feat: add needsExpenseCategory predicate + validation hook"
```

---

### Task 5: Transfer table + lookups

**Files:**

- Modify: `src/lib/tables/transfers.tsx:19-52,57-71,78-134,168-316`
- Test: `src/__tests__/transfer-table.test.ts`

**Step 1: Add to TransferRowT**

Add field:

```typescript
readonly expenseCategoryId: number | null
readonly expenseCategoryName: string
```

**Step 2: Add to TransferLookupsT**

Add: `readonly expenseCategories: NameMapT`

**Step 3: Update buildTransferLookups**

Add: `expenseCategories: toNameMap(refData.expenseCategories)`

**Step 4: Update mapTransferRow (both branches)**

Lookups branch: `expenseCategoryId: toNullableId(doc.expenseCategory), expenseCategoryName: lookupName(lookups.expenseCategories, doc.expenseCategory)`

Populated branch: `expenseCategoryId: toNullableId(doc.expenseCategory), expenseCategoryName: getRelationName(doc.expenseCategory)`

**Step 5: Add column definition**

After the `investmentName` column (line 257), add:

```typescript
col.accessor('expenseCategoryName', {
  id: 'expenseCategory',
  header: 'Kategoria wydatku',
  cell: (info) => info.getValue(),
}),
```

**Step 6: Update transfer-table tests**

Update test fixtures in `src/__tests__/transfer-table.test.ts` to include `expenseCategoryId` and `expenseCategoryName`.

**Step 7: Run tests**

```bash
pnpm test -- src/__tests__/transfer-table.test.ts
```

**Step 8: Commit**

```bash
git add src/lib/tables/transfers.tsx src/__tests__/transfer-table.test.ts
git commit -m "feat: add expenseCategory column to transfer table"
```

---

### Task 6: SQL queries + InvestmentFinancialsT

**Files:**

- Modify: `src/lib/db/sum-transfers.ts:104-141,204-227,257-268`
- Test: `src/__tests__/sum-transfers.test.ts`

**Step 1: Write failing tests**

Add to `src/__tests__/sum-transfers.test.ts`:

```typescript
describe('sumAllInvestmentFinancials — with category breakdown', () => {
  it('returns per-category costs alongside totals', async () => {
    // First call: existing main query (totals + income + labor)
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          investment_id: '1',
          total_costs: '7000',
          total_income: '10000',
          total_labor_costs: '800',
        },
      ],
    })
    // Second call: category breakdown query
    mockExecute.mockResolvedValueOnce({
      rows: [
        { investment_id: '1', expense_category_id: '1', category_total: '5000' },
        { investment_id: '1', expense_category_id: '2', category_total: '2000' },
      ],
    })
    const map = await sumAllInvestmentFinancials(fakePayload)
    const inv = map.get(1)!
    expect(inv.totalMaterialCosts).toBe(7000)
    expect(inv.totalIncome).toBe(10000)
    expect(inv.totalLaborCosts).toBe(800)
    expect(inv.categoryCosts).toEqual([
      { categoryId: 1, total: 5000 },
      { categoryId: 2, total: 2000 },
    ])
  })
})
```

Also add test for `deriveFinancials`:

```typescript
describe('deriveFinancials — with category totals', () => {
  it('derives per-category costs from type+category distribution', () => {
    const byType = [
      { type: 'INVESTMENT_EXPENSE', total: 5000 },
      { type: 'EMPLOYEE_EXPENSE', total: 2000 },
      { type: 'INVESTOR_DEPOSIT', total: 12000 },
      { type: 'LABOR_COST', total: 800 },
    ]
    const byCat = [
      { categoryId: 1, total: 5000 },
      { categoryId: 2, total: 2000 },
    ]
    const result = deriveFinancials(byType, byCat)
    expect(result.totalMaterialCosts).toBe(7000)
    expect(result.categoryCosts).toEqual(byCat)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/__tests__/sum-transfers.test.ts
```

**Step 3: Update types**

Replace `InvestmentFinancialsT`:

```typescript
export type CategoryCostT = {
  readonly categoryId: number
  readonly total: number
}

export type InvestmentFinancialsT = {
  readonly categoryCosts: readonly CategoryCostT[]
  readonly totalMaterialCosts: number
  readonly totalIncome: number
  readonly totalLaborCosts: number
}
```

**Step 4: Update sumAllInvestmentFinancials**

Add a second SQL query for category breakdown:

```sql
SELECT investment_id, expense_category_id,
  COALESCE(SUM(amount), 0) AS category_total
FROM transactions
WHERE investment_id IS NOT NULL
  AND cancelled IS NOT TRUE
  AND type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
  AND expense_category_id IS NOT NULL
GROUP BY investment_id, expense_category_id
```

Merge both results into the map. The main query still provides `total_costs` (renamed `totalMaterialCosts`), the category query provides the per-category breakdown.

**Step 5: Update deriveFinancials**

Change signature to accept optional `categoryCosts` parameter:

```typescript
export function deriveFinancials(
  byType: readonly TypeTotalT[],
  categoryCosts: readonly CategoryCostT[] = [],
): InvestmentFinancialsT {
  return {
    categoryCosts,
    totalMaterialCosts:
      totalByType(byType, 'INVESTMENT_EXPENSE') + totalByType(byType, 'EMPLOYEE_EXPENSE'),
    totalIncome: totalByType(byType, 'INVESTOR_DEPOSIT'),
    totalLaborCosts: totalByType(byType, 'LABOR_COST'),
  }
}
```

**Step 6: Update FIELD_TO_COLUMN map**

Add: `expenseCategory: 'expense_category_id',`

**Step 7: Run tests**

```bash
pnpm test -- src/__tests__/sum-transfers.test.ts
```

**Step 8: Fix any type errors from InvestmentFinancialsT rename (totalCosts → totalMaterialCosts)**

The following files reference `totalCosts`:

- `src/app/(frontend)/inwestycje/[id]/page.tsx:44`
- `src/app/(frontend)/raporty/page.tsx:38`
- `src/components/reports/report-charts.tsx:20`
- `src/lib/queries/reference-data.ts:150-153` (the map building)

Update all to use `totalMaterialCosts`. Run:

```bash
pnpm typecheck
```

**Step 9: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts src/app/ src/components/reports/ src/lib/queries/
git commit -m "feat: per-category cost breakdown in SQL queries and financials type"
```

---

### Task 7: Dynamic stat cards on investment + reports pages

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx:35-55`
- Modify: `src/app/(frontend)/raporty/page.tsx:31-49`
- Modify: `src/lib/queries/reference-data.ts` (fetch expense categories for name resolution)

**Step 1: Update investment detail page**

In `src/app/(frontend)/inwestycje/[id]/page.tsx`, change `headerFields` construction.

Currently:

```typescript
const { totalCosts, totalIncome, totalLaborCosts } = deriveFinancials(typeDistribution)
```

After: need category names from refData + category cost data. The `deriveFinancials` for a single investment page uses `typeDistribution` from `fetchFilteredByType`. We also need per-category totals for this specific investment.

Add a new query `sumCategoryBreakdown` (or extend `fetchFilteredByType`) that returns `CategoryCostT[]` for the given `where` filter. Then build `headerFields` dynamically:

```typescript
const { totalMaterialCosts, totalIncome, totalLaborCosts, categoryCosts } = deriveFinancials(
  typeDistribution,
  categoryBreakdown,
)

const expenseCatMap = new Map(refData.expenseCategories.map((c) => [c.id, c.name]))

const headerFields: HeaderFieldT[] = [
  { label: 'Inwestycja', value: investment.name },
  // Dynamic per-category cards
  ...categoryCosts.map((cc) => ({
    label: expenseCatMap.get(cc.categoryId) ?? `Kategoria #${cc.categoryId}`,
    value: formatPLN(cc.total),
    amount: -cc.total,
  })),
  // Combined material costs
  {
    label: 'Koszty materiałowe',
    value: formatPLN(totalMaterialCosts),
    amount: -totalMaterialCosts,
  },
  { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome), amount: totalIncome },
  { label: 'Koszty robocizny', value: formatPLN(totalLaborCosts), amount: -totalLaborCosts },
  { label: BILANS_LABEL, value: formatPLN(totalIncome - totalMaterialCosts - totalLaborCosts) },
]
```

**Step 2: Add sumCategoryBreakdown query**

In `src/lib/db/sum-transfers.ts`, add a new function:

```typescript
export const sumCategoryBreakdown = async (
  payload: Payload,
  where: Where,
): Promise<CategoryCostT[]> => {
  if (isNoResultsSentinel(where)) return []

  const db = await getDb(payload)
  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
      SELECT expense_category_id, COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE cancelled IS NOT TRUE
        AND type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
        AND expense_category_id IS NOT NULL
        ${conditions}
      GROUP BY expense_category_id
    `),
  )

  return result.rows.map((row: any) => ({
    categoryId: Number(row.expense_category_id),
    total: Number(row.total),
  }))
}
```

Add cached wrapper in `src/lib/queries/reference-data.ts`:

```typescript
export async function fetchCategoryBreakdown(where: Where): Promise<CategoryCostT[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const payload = await getPayload({ config })
  return sumCategoryBreakdown(payload, where)
}
```

**Step 3: Update investment page to fetch category breakdown in parallel**

```typescript
const [refData, typeDistribution, categoryBreakdown] = await Promise.all([
  fetchReferenceData(),
  fetchFilteredByType(transferWhere),
  fetchCategoryBreakdown(transferWhere),
])
```

**Step 4: Update reports page similarly**

Same pattern — fetch `categoryBreakdown`, build dynamic `headerFields`, update chart data.

**Step 5: Update InvestmentStats grid**

The grid currently uses `lg:grid-cols-4`. With dynamic categories, update to responsive auto-fit:

```typescript
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
```

Or keep `lg:grid-cols-4` and let overflow wrap naturally (likely fine with 6-7 cards).

**Step 6: Update ReportChart**

In `src/components/reports/report-charts.tsx`, rename `financials.totalCosts` → `financials.totalMaterialCosts`.

**Step 7: Run typecheck + dev**

```bash
pnpm typecheck
```

**Step 8: Commit**

```bash
git add src/app/ src/lib/db/sum-transfers.ts src/lib/queries/reference-data.ts src/components/
git commit -m "feat: dynamic per-category stat cards on investment and reports pages"
```

---

### Task 8: Transfer form + settlement form

**Files:**

- Modify: `src/components/forms/transfer-form/transfer-form.tsx:48-59,88-91,98-113,150-156,272-276`
- Modify: `src/components/forms/transfer-form/transfer-schema.ts:14-21,29-66,76-93,130-164,166-189`
- Modify: `src/components/forms/settlement-form/settlement-form.tsx:30-36,45-56,105-124,248-250`
- Modify: `src/components/forms/settlement-form/settlement-schema.ts`
- Modify: `src/lib/actions/transfers.ts:44-52,92-113`
- Modify: `src/lib/actions/settlements.ts:34-46,68-85`

**Step 1: Add expenseCategory to form schemas**

In `transfer-schema.ts`:

- Add `expenseCategory` to `TransferFieldsT`
- Add validation rule: `{ invalid: (d) => needsExpenseCategory(d.type) && !d.expenseCategory, message: 'Kategoria wydatku jest wymagana', path: 'expenseCategory' }`
  - Note: this handles `INVESTMENT_EXPENSE`. For `EMPLOYEE_EXPENSE` with investment, add rule: `{ invalid: (d) => d.type === 'EMPLOYEE_EXPENSE' && !!d.investment && !d.expenseCategory, message: 'Kategoria wydatku jest wymagana', path: 'expenseCategory' }`
- Add `expenseCategory: z.number().optional()` to `createTransferSchema`
- Add `expenseCategory: z.string().optional().default('')` to client schemas
- Add `expenseCategory: z.string()` to `bulkTransferFormSchema`
- Add `expenseCategory: z.number().optional()` to `createBulkTransferSchema`

**Step 2: Add to transfer form UI**

In `transfer-form.tsx`:

- Add `expenseCategory` to `FormValuesT`
- Add `expenseCategory: ''` to default values
- Add `'expenseCategory'` to `conditionalFields` array
- Add to `onSubmit` data: `expenseCategory: value.expenseCategory ? Number(value.expenseCategory) : undefined`
- After the investment field (line 276), add:

```typescript
{/* Expense category — for INVESTMENT_EXPENSE or EMPLOYEE_EXPENSE with investment */}
{(currentType === 'INVESTMENT_EXPENSE' ||
  (currentType === 'EMPLOYEE_EXPENSE' && expenseTarget === 'investment')) && (
  <form.AppField name="expenseCategory">
    {(field) => (
      <field.Select label="Kategoria wydatku" placeholder="Wybierz kategorię" showError>
        {referenceData.expenseCategories.map((cat) => (
          <SelectItem key={cat.id} value={String(cat.id)}>
            {cat.name}
          </SelectItem>
        ))}
      </field.Select>
    )}
  </form.AppField>
)}
```

**Step 3: Add to settlement form**

In `settlement-form.tsx`:

- Add `expenseCategories: ReferenceItemT[]` to `SettlementReferenceDataT`
- Add `expenseCategory: string` to `FormValuesT`, default `''`
- After `InvestmentField` in investment mode (line 249), add expense category select
- In `onSubmit`, pass `expenseCategory: value.mode === 'investment' ? Number(value.expenseCategory) : undefined`

In `settlement-schema.ts`:

- Add `expenseCategory: z.string()` to client schema
- Add `expenseCategory: z.number().positive().optional()` to server schema
- Add validation: if `mode === 'investment'` require `expenseCategory`

**Step 4: Update server actions**

In `src/lib/actions/transfers.ts`:

- `createTransferAction`: `data` spread already passes `expenseCategory` through
- `createBulkTransferAction`: add `expenseCategory: parsed.data.expenseCategory` to the `payload.create` data object (line 107)

In `src/lib/actions/settlements.ts`:

- Add `expenseCategory: parsed.data.expenseCategory` to both `payload.create` calls (register refund at line 40, and investment mode at line 77)

**Step 5: Update settlement form callers**

Search for components that render `SettlementForm` and make sure they pass `expenseCategories` in `referenceData`. Check:

```bash
pnpm typecheck
```

**Step 6: Run tests**

```bash
pnpm test -- src/__tests__/transfer-schema.test.ts src/__tests__/settlement-schema.test.ts src/__tests__/transfer-actions.test.ts src/__tests__/settlement-actions.test.ts
```

Fix any failures — update test fixtures to include `expenseCategory` field.

**Step 7: Commit**

```bash
git add src/components/forms/ src/lib/actions/ src/__tests__/
git commit -m "feat: add expense category selector to transfer and settlement forms"
```

---

### Task 9: Investment list page financials

**Files:**

- Check: `src/app/(frontend)/inwestycje/page.tsx` (or wherever investments are listed)

**Step 1: Check if investment list shows cost totals**

If it uses `fetchInvestmentFinancials()` (which calls `sumAllInvestmentFinancials`), it already gets the new `InvestmentFinancialsT` shape. Update any `totalCosts` references to `totalMaterialCosts`.

**Step 2: Run typecheck to find remaining references**

```bash
pnpm typecheck
```

Fix all remaining type errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: update remaining totalCosts references to totalMaterialCosts"
```

---

### Task 10: Update all tests + final verification

**Files:**

- Modify: all test files with `EMPLOYEE_EXPENSE` or `INVESTMENT_EXPENSE` fixtures
- Modify: `src/__tests__/transfer-schema.test.ts`
- Modify: `src/__tests__/validate-hook.test.ts`
- Modify: `src/__tests__/settlement-actions.test.ts`
- Modify: `src/__tests__/transfer-actions.test.ts`
- Modify: `src/__tests__/sum-transfers.test.ts`
- Modify: `src/__tests__/transfer-table.test.ts`

**Step 1: Run full test suite**

```bash
pnpm test
```

**Step 2: Fix all failing tests**

Common fixes needed:

- Add `expenseCategory` to test fixtures for `INVESTMENT_EXPENSE` and `EMPLOYEE_EXPENSE` types
- Update `sumAllInvestmentFinancials` mock return values
- Update `deriveFinancials` assertions for new shape
- Update `TransferRowT` test fixtures

**Step 3: Run typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

**Step 4: Commit**

```bash
git add src/__tests__/
git commit -m "test: update all tests for expense categories"
```

---

### Task 11: Run /simplify + final review

**Step 1: Run /simplify**

Review all changed code for reuse opportunities, quality, and efficiency.

**Step 2: Update CLAUDE.md**

Add `expense-categories` to the collections list and update the Transfer Business Logic section.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: simplify + update docs for expense categories"
```

---

### Task 12: Create PR

```bash
gh pr create --title "feat: expense categories for investment transfers" --body "$(cat <<'EOF'
## Summary
- New `expense-categories` Payload collection with seed data (Materiały budowlane, Materiały wykończeniowe)
- New `expenseCategory` relationship field on transfers, required for investment-related expenses
- Per-category stat cards on investment detail and reports pages
- Expense category selector in transfer form and settlement form dialogs
- Migration with backfill of existing rows to default category

## Test plan
- [ ] Run `pnpm test` — all tests pass
- [ ] Run `pnpm typecheck` — no errors
- [ ] Create INVESTMENT_EXPENSE transfer — expense category required
- [ ] Create EMPLOYEE_EXPENSE with investment — expense category required
- [ ] Create EMPLOYEE_EXPENSE with category (not investment) — no expense category field shown
- [ ] Investment detail page shows per-category stat cards
- [ ] Reports page shows per-category stat cards
- [ ] Add new expense category in admin → appears in forms and stat cards automatically

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
