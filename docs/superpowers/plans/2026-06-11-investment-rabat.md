# Investment Rabat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `RABAT` transfer type — a positive złoty discount on labour that reduces both the client balance (bilans) and company margin (marża).

**Architecture:** One new transfer type flows through the single financial funnel (`deriveFinancials`). It adds a `totalRabat` aggregate that two formula files consume: `calculateBalance` (`+rabat`) and `calculateMargin` (`−rabat`). A distinct "Rabat" display line is grouped with the green income row. No cash movement and no Google Sheets sync — both are skipped for free because the type carries no `sourceRegister` and the sheet hooks gate on `INVESTMENT_EXPENSE`.

**Tech Stack:** Next.js + Payload CMS, Postgres (`@payloadcms/db-vercel-postgres`), Zod, Vitest. Run tests with `pnpm exec vitest run <file>` (aliases `@/*` → `./src/*`).

**Spec:** `docs/superpowers/specs/2026-06-11-investment-rabat-design.md`

---

## Notes for the implementer

- **Polish UI, English code.** The user-facing label is `Rabat`; the type value is `RABAT`.
- `RABAT` mirrors `LABOR_COST` for cash semantics: **no source register**, **requires an investment**, `paymentMethod` stays (defaults `CASH`).
- Validation is free: the default branch of `getAmountError` already rejects `amount <= 0`, and the field-requirement rules in `src/lib/schemas/transfer.ts` are driven by the predicate helpers you edit in Task 1 — so adding `RABAT` to `requiresInvestment`/`needsSourceRegister` cascades into both client and server validation automatically.
- `InvestmentFinancialsT` gains a required `totalRabat` field in Task 2. After that, **every** place that constructs the type must set it — TypeScript will flag any you miss at typecheck. Tasks 2 and 4 cover all current construction sites.
- Do **not** `git add` `src/payload-types.ts` (gitignored) or any other agent's in-flight changes. Stage only the files each task names, by explicit path.
- Do not push; a human pushes. `pnpm build` runs `payload migrate`.

---

## Task 1: Add the `RABAT` transfer type and predicates

**Files:**

- Modify: `src/lib/constants/transfers.ts`
- Modify: `src/collections/transfers.ts`
- Test: `src/__tests__/transfer-rabat.test.ts` (create)

- [ ] **Step 1: Write the failing predicate test**

Create `src/__tests__/transfer-rabat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  isTransferType,
  requiresInvestment,
  needsSourceRegister,
  showsInvestment,
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
} from '@/lib/constants/transfers'

describe('RABAT transfer type', () => {
  it('is a recognised transfer type with a Polish label', () => {
    expect(isTransferType('RABAT')).toBe(true)
    expect(TRANSFER_TYPE_LABELS.RABAT).toBe('Rabat')
  })

  it('requires an investment and shows the investment field', () => {
    expect(requiresInvestment('RABAT')).toBe(true)
    expect(showsInvestment('RABAT')).toBe(true)
  })

  it('has no source register (like LABOR_COST)', () => {
    expect(needsSourceRegister('RABAT')).toBe(false)
  })

  it('appears in the transaction transfer dialog', () => {
    expect(TRANSACTION_TRANSFER_TYPES).toContain('RABAT')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/transfer-rabat.test.ts`
Expected: FAIL — `isTransferType('RABAT')` is `false`, `TRANSFER_TYPE_LABELS.RABAT` is `undefined`.

- [ ] **Step 3: Add `RABAT` to `src/lib/constants/transfers.ts`**

In `TRANSFER_TYPES` (sorted by Polish label), insert `'RABAT'` after `'LABOR_COST'`:

```ts
export const TRANSFER_TYPES = [
  'CANCELLATION', // Anulowanie
  'OTHER_DEPOSIT', // Inna wpłata
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'RABAT', // Rabat
  'REGISTER_TRANSFER', // Transfer między kasami
  'INVESTOR_DEPOSIT', // Wpłata od inwestora
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'PAYOUT', // Wypłata
  'COMPANY_FUNDING', // Zasilenie z konta firmowego
] as const
```

Add to `TRANSFER_TYPE_LABELS`:

```ts
  RABAT: 'Rabat',
```

Add to `TRANSFER_TYPE_COLORS` (green to signal "adds to balance / good for client"):

```ts
  RABAT: 'chart-green',
```

In `TRANSACTION_TRANSFER_TYPES` (sorted by Polish label), insert `'RABAT'` after `'LABOR_COST'`:

```ts
export const TRANSACTION_TRANSFER_TYPES: TransferTypeT[] = [
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'RABAT', // Rabat
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'PAYOUT', // Wypłata
]
```

Add `'RABAT'` to `INVESTMENT_TYPES`:

```ts
export const INVESTMENT_TYPES: TransferTypeT[] = [
  ...COST_TYPES,
  ...DEPOSIT_TYPES,
  'CORRECTION',
  'PAYOUT',
  'RABAT',
]
```

Update `needsSourceRegister` to also exclude `RABAT`:

```ts
export const needsSourceRegister = (type: string) =>
  isTransferType(type) && type !== 'LABOR_COST' && type !== 'RABAT'
```

Update `requiresInvestment` to include `RABAT`:

```ts
export const requiresInvestment = (type: string) =>
  isTransferType(type) &&
  (type === 'INVESTOR_DEPOSIT' ||
    type === 'INVESTMENT_EXPENSE' ||
    type === 'LABOR_COST' ||
    type === 'RABAT')
```

(`showsInvestment` reads `INVESTMENT_TYPES`, so it already returns `true` for `RABAT` after the array edit above — no separate change.)

- [ ] **Step 4: Mirror the field conditions in `src/collections/transfers.ts`**

Add a `RABAT` option to the collection's `TRANSFER_TYPES` array, after the `LABOR_COST` entry:

```ts
  { label: { en: 'Rebate', pl: 'Rabat' }, value: 'RABAT' },
```

Update `showSourceRegister` to exclude `RABAT`:

```ts
/** Show sourceRegister for all types except LABOR_COST and RABAT (billing figures, no cash movement) */
const showSourceRegister = (data: Record<string, unknown>) =>
  data?.type !== 'LABOR_COST' && data?.type !== 'RABAT'
```

Update `showInvestment` to include `RABAT`:

```ts
const showInvestment = (data: Record<string, unknown>) =>
  data?.type === 'INVESTOR_DEPOSIT' ||
  data?.type === 'INVESTMENT_EXPENSE' ||
  data?.type === 'LABOR_COST' ||
  data?.type === 'PAYOUT' ||
  data?.type === 'CORRECTION' ||
  data?.type === 'RABAT'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/transfer-rabat.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants/transfers.ts src/collections/transfers.ts src/__tests__/transfer-rabat.test.ts
git commit -m "feat(transfers): add RABAT type, labels, and field predicates"
```

---

## Task 2: Add `totalRabat` to the financial funnel

**Files:**

- Modify: `src/lib/db/sum-transfers.ts`
- Test: `src/__tests__/sum-transfers.test.ts`

- [ ] **Step 1: Update the failing tests**

In `src/__tests__/sum-transfers.test.ts`, the `deriveFinancials` and `sumAllInvestmentFinancials` `toEqual` assertions must include `totalRabat`. Make these edits:

In `describe('deriveFinancials', ...)`, first test — add a `RABAT` row and `totalRabat` to the expected object:

```ts
it('derives totals from type distribution', () => {
  const byType = [
    { type: 'INVESTMENT_EXPENSE', total: 5000 },
    { type: 'INVESTOR_DEPOSIT', total: 12000 },
    { type: 'LABOR_COST', total: 800 },
    { type: 'PAYOUT', total: 300 },
    { type: 'RABAT', total: 200 },
  ]
  expect(deriveFinancials(byType)).toEqual({
    categoryCosts: [],
    totalMaterialCosts: 5000,
    totalCorrections: 0,
    totalIncome: 12000,
    totalLaborCosts: 800,
    totalPayouts: 300,
    totalRabat: 200,
  })
})
```

Same `describe`, "returns zeros for empty array" — add `totalRabat: 0`:

```ts
expect(deriveFinancials([])).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
})
```

In `describe('sumAllInvestmentFinancials', ...)`, "returns a Map of investment financials": add `total_rabat` to both mock rows and `totalRabat` to both expected objects:

```ts
          {
            investment_id: '1',
            total_costs: '3000',
            total_corrections: '0',
            total_income: '10000',
            total_labor_costs: '200',
            total_payouts: '150',
            total_rabat: '50',
          },
          {
            investment_id: '2',
            total_costs: '500',
            total_corrections: '0',
            total_income: '0',
            total_labor_costs: '0',
            total_payouts: '0',
            total_rabat: '0',
          },
```

```ts
expect(map.get(1)).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 3000,
  totalCorrections: 0,
  totalIncome: 10000,
  totalLaborCosts: 200,
  totalPayouts: 150,
  totalRabat: 50,
})
expect(map.get(2)).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 500,
  totalCorrections: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: FAIL — returned objects lack `totalRabat`; mock `total_rabat` is ignored.

- [ ] **Step 3: Add `totalRabat` to the type and both producers**

In `src/lib/db/sum-transfers.ts`, add the field to `InvestmentFinancialsT`:

```ts
export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  totalMaterialCosts: number
  totalCorrections: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalRabat: number
}
```

In `sumAllInvestmentFinancials`, add the SQL aggregate to the `totalsResult` query (after `total_payouts`):

```ts
        COALESCE(SUM(CASE WHEN type = 'PAYOUT' THEN amount ELSE 0 END), 0) AS total_payouts,
        COALESCE(SUM(CASE WHEN type = 'RABAT' THEN amount ELSE 0 END), 0) AS total_rabat
```

In the same function's `map.set(...)`, add:

```ts
      totalPayouts: Number(row.total_payouts),
      totalRabat: Number(row.total_rabat),
```

In `deriveFinancials`, add to the returned object:

```ts
    totalLaborCosts: totalByType(byType, 'LABOR_COST'),
    totalPayouts: totalByType(byType, 'PAYOUT'),
    totalRabat: totalByType(byType, 'RABAT'),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "feat(financials): aggregate totalRabat in deriveFinancials and SQL"
```

---

## Task 3: `calculateBalance` adds the rabat

**Files:**

- Modify: `src/lib/calculate-balance.ts`
- Test: `src/__tests__/calculate-balance.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/calculate-balance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calculateBalance } from '@/lib/calculate-balance'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
}

describe('calculateBalance', () => {
  it('is income minus material and labour costs when there is no rabat', () => {
    expect(
      calculateBalance({
        ...base,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
      }),
    ).toBe(5000)
  })

  it('adds the rabat so the client owes less', () => {
    expect(
      calculateBalance({
        ...base,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
        totalRabat: 800,
      }),
    ).toBe(5800)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/calculate-balance.test.ts`
Expected: FAIL — second case returns `5000` (rabat ignored).

- [ ] **Step 3: Add the rabat to the formula**

Replace the body of `src/lib/calculate-balance.ts`:

```ts
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

// Bilans inwestora (investor balance) = income - material costs - labor costs + rabat.
// Material costs already include corrections (negative corrections reduce costs).
// A rabat is a labour discount: the client owes less, so it RAISES the balance.
export function calculateBalance(financials: InvestmentFinancialsT) {
  const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
  return financials.totalIncome - totalCosts + financials.totalRabat
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/calculate-balance.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculate-balance.ts src/__tests__/calculate-balance.test.ts
git commit -m "feat(financials): rabat raises the investor balance"
```

---

## Task 4: `calculateMargin` subtracts the rabat (signature change + callers)

**Files:**

- Modify: `src/lib/calculate-margin.ts`
- Modify: `src/lib/queries/investments.ts`
- Modify: `src/components/investments/financial-stats.tsx`
- Test: `src/__tests__/calculate-margin.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/calculate-margin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calculateMargin } from '@/lib/calculate-margin'

describe('calculateMargin', () => {
  it('is labour minus payouts when there is no rabat', () => {
    expect(calculateMargin(5000, 1000)).toBe(4000)
  })

  it('subtracts the rabat from the margin', () => {
    expect(calculateMargin(5000, 1000, 800)).toBe(3200)
  })

  it('defaults rabat to 0 when omitted', () => {
    expect(calculateMargin(5000, 1000, undefined)).toBe(4000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts`
Expected: FAIL — `calculateMargin(5000, 1000, 800)` returns `4000` (third arg ignored).

- [ ] **Step 3: Add the rabat parameter**

Replace `src/lib/calculate-margin.ts`:

```ts
// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts are the company's already-withdrawn profit.
// A rabat is a discount on the labour price — the company's own cost — so it lowers margin.
// Margin = laborCosts - payouts - rabat = profit still available.
export const calculateMargin = (laborCosts: number, totalPayouts: number, rabat = 0) =>
  laborCosts - totalPayouts - rabat
```

- [ ] **Step 4: Update the `queries/investments.ts` caller and fallback**

In `src/lib/queries/investments.ts`, add `totalRabat: 0` to the fallback `financials` object:

```ts
const financials = fin ?? {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
}
```

Update the `margin` line to pass the rabat:

```ts
      margin: calculateMargin(financials.totalLaborCosts, financials.totalPayouts, financials.totalRabat),
```

- [ ] **Step 5: Update the `financial-stats.tsx` caller**

In `src/components/investments/financial-stats.tsx`, add `totalRabat` to the props type and signature (default 0):

```ts
type FinancialStatsPropsT = {
  fields: FinancialFieldT[]
  totalLaborCosts: number
  totalPayouts?: number
  totalRabat?: number
}

export function FinancialStats({
  fields,
  totalLaborCosts,
  totalPayouts = 0,
  totalRabat = 0,
}: FinancialStatsPropsT) {
```

Update the margin computation:

```ts
const margin = calculateMargin(totalLaborCosts, totalPayouts, totalRabat)
```

(The green-row grouping for the Rabat display line is added in Task 5, which also passes `totalRabat` from the pages.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck the changed callers**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (no remaining `InvestmentFinancialsT` constructor is missing `totalRabat`; both `calculateMargin` callers compile).

- [ ] **Step 8: Commit**

```bash
git add src/lib/calculate-margin.ts src/lib/queries/investments.ts src/components/investments/financial-stats.tsx src/__tests__/calculate-margin.test.ts
git commit -m "feat(financials): rabat lowers the margin"
```

---

## Task 5: Display the Rabat line (green) and wire it from the pages

**Files:**

- Modify: `src/lib/map-category-costs.ts`
- Modify: `src/components/investments/financial-stats.tsx`
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx`
- Modify: `src/app/(frontend)/raporty/page.tsx`
- Test: `src/__tests__/map-category-costs.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/map-category-costs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFinancialFields } from '@/lib/map-category-costs'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 5000,
  totalLaborCosts: 1000,
  totalPayouts: 0,
  totalRabat: 0,
}

describe('buildFinancialFields — rabat row', () => {
  it('omits the Rabat field when totalRabat is 0', () => {
    const fields = buildFinancialFields(base, [])
    expect(fields.find((f) => f.label === 'Rabat')).toBeUndefined()
  })

  it('emits a positive Rabat field when there is a rabat', () => {
    const fields = buildFinancialFields({ ...base, totalRabat: 800 }, [])
    const rabat = fields.find((f) => f.label === 'Rabat')
    expect(rabat).toBeDefined()
    expect(rabat!.amount).toBe(800)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/map-category-costs.test.ts`
Expected: FAIL — no field labelled `Rabat`.

- [ ] **Step 3: Emit the Rabat field in `buildFinancialFields`**

In `src/lib/map-category-costs.ts`, destructure `totalRabat` and append the field after `Wpłaty`:

```ts
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  const { categoryCosts, totalCorrections, totalIncome, totalLaborCosts, totalRabat } = financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    ...(totalCorrections !== 0
      ? [{ label: 'Korekty', value: formatPLN(totalCorrections), amount: -totalCorrections }]
      : []),
    {
      label: 'Robocizna',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
    ...(totalRabat !== 0
      ? [{ label: 'Rabat', value: formatPLN(totalRabat), amount: totalRabat }]
      : []),
  ]
}
```

- [ ] **Step 4: Group the Rabat line into the green row in `financial-stats.tsx`**

In `src/components/investments/financial-stats.tsx`, add the label constant near the others:

```ts
const INCOME_LABEL = 'Wpłaty'
const CORRECTION_LABEL = 'Korekty'
const LABOR_LABEL = 'Robocizna'
const RABAT_LABEL = 'Rabat'
```

Exclude `Rabat` from the red `expenseRow` filter:

```ts
const expenseRow = fields
  .filter(
    (f) =>
      f.label !== INCOME_LABEL &&
      f.label !== CORRECTION_LABEL &&
      f.label !== LABOR_LABEL &&
      f.label !== RABAT_LABEL,
  )
  .map((f) => addBtnBorderColor(f, 'border-chart-red'))
```

Include `Rabat` in the green `incomeRow` filter:

```ts
const incomeRow = fields
  .filter(
    (f) => f.label === INCOME_LABEL || f.label === CORRECTION_LABEL || f.label === RABAT_LABEL,
  )
  .map((f) => addBtnBorderColor(f, 'border-chart-green'))
```

- [ ] **Step 5: Pass `totalRabat` from both pages**

In `src/app/(frontend)/inwestycje/[id]/page.tsx`, add the prop to the `<FinancialStats>` render (next to `totalLaborCosts={financials.totalLaborCosts}`):

```tsx
        totalLaborCosts={financials.totalLaborCosts}
        totalRabat={financials.totalRabat}
```

In `src/app/(frontend)/raporty/page.tsx`, add the same prop next to its `totalLaborCosts={financials.totalLaborCosts}`:

```tsx
        totalLaborCosts={financials.totalLaborCosts}
        totalRabat={financials.totalRabat}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/map-category-costs.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/map-category-costs.ts src/components/investments/financial-stats.tsx "src/app/(frontend)/inwestycje/[id]/page.tsx" "src/app/(frontend)/raporty/page.tsx" src/__tests__/map-category-costs.test.ts
git commit -m "feat(investments): show Rabat line in the green balance row"
```

---

## Task 6: Database migration — add the `RABAT` enum value

**Files:**

- Create: `src/migrations/20260611_add_rabat_enum.ts`
- Modify: `src/migrations/index.ts`

- [ ] **Step 1: Create the migration (mirrors `20260325_add_correction_enum.ts`)**

Create `src/migrations/20260611_add_rabat_enum.ts`:

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (mirrors 20260325_add_correction_enum) — migrate:create's snapshot
// baseline is stale on this branch (see AGENTS.md / project memory).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE enum_transactions_type ADD VALUE IF NOT EXISTS 'RABAT';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing enum values — no-op
}
```

- [ ] **Step 2: Register it in `src/migrations/index.ts`**

Add the import at the end of the import block (after `migration_20260528_move_sheet_id_to_kosztoryses`):

```ts
import * as migration_20260611_add_rabat_enum from './20260611_add_rabat_enum'
```

Append the entry at the end of the `migrations` array (after the `20260528_move_sheet_id_to_kosztoryses` entry, before the closing `]`):

```ts
  {
    up: migration_20260611_add_rabat_enum.up,
    down: migration_20260611_add_rabat_enum.down,
    name: '20260611_add_rabat_enum',
  },
```

- [ ] **Step 3: Apply the migration locally**

Run: `pnpm payload migrate`
Expected: output reports `20260611_add_rabat_enum` applied (the enum now accepts `'RABAT'`).

> If `payload migrate` reports "Done." with nothing executed, check the `_payload_migrations` table for a stale record (see project memory) before re-running.

- [ ] **Step 4: Commit**

```bash
git add src/migrations/20260611_add_rabat_enum.ts src/migrations/index.ts
git commit -m "feat(db): add RABAT to the transactions type enum"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm exec vitest run`
Expected: all tests pass (including the four new/updated files).

- [ ] **Step 2: Typecheck the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test (requires the migration from Task 6 applied)**

Start the app (`pnpm dev`), open the expense/transfer dialog, and:

- Confirm `Rabat` appears in the type dropdown.
- Select `Rabat`: the **Source register field is hidden**, the **Investment field is shown and required**, no expense-category field appears.
- Create a rabat (e.g. 800 zł) on an investment that has robocizna and deposits.
- On the investment page, confirm:
  - A green **Rabat** line shows `800,00 zł` and toggling it **raises** Bilans inwestora.
  - As admin, **Marża drops** by 800 vs before.
  - The kosztorys Google Sheet for that investment is **unchanged** (no rabat row written).

---

## Self-review notes (for the implementer)

- **Spec coverage:** type (T1), funnel/`totalRabat` (T2), balance `+rabat` (T3), margin `−rabat` (T4), green display + page wiring (T5), migration (T6), no-sheets-sync verified in T7. Validation needs no task (free via default `getAmountError` + predicate-driven rules) — confirmed by the spec.
- **No-sheet-sync is free:** both sheet sync paths gate on `type === 'INVESTMENT_EXPENSE'` (`src/hooks/transfers/sync-sheet.ts:30,52` and `src/lib/actions/sheets-sync.ts:344`), so a `RABAT` row is skipped without any edit.
- **Type-name consistency:** `totalRabat` (field), `RABAT` (enum value/type), `'Rabat'` (PL label) used identically across all tasks.
