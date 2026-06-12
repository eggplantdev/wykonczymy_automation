# „Materiały wliczone w robociznę" (settled internal material) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log an `INVESTMENT_EXPENSE` flagged `settled` (material already inside the robocizna price): it leaves the cash register, is excluded from the investor balance (bilans), and reduces marża — surfaced as a distinct orange category in the transfers table, a split-by-category out-of-bilans stat block, and a figure in the investments list.

**Architecture:** A `settled` boolean on the `transactions` row (NOT a new transfer type — keeps `expense_category` for the owner's building-vs-finishing breakdown). The cash ledger is untouched (still a real spend). The investment P&L excludes settled from every material/category aggregate that feeds bilans, and routes it into a new `totalSettled` bucket that only marża reads. Display differentiation is a special-case on the boolean; the stored `type` stays `INVESTMENT_EXPENSE`.

**Tech Stack:** Next.js (App Router), Payload CMS, raw SQL via `@payloadcms/db-vercel-postgres`, TanStack Table/Form, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-settled-internal-material-design.md`. Math/Sheets context: `docs/plan-settled-expenses.md`, `docs/investment-financials-and-discount.md`.

**Scope:** Phase 1 (app) only. Phase 2 (Google Sheets) is deferred to `docs/plan-settled-expenses.md` §FAZA 2.

**Project rules:** Hand-write migrations. Never `git add` `src/payload-types.ts` (gitignored). No `git push`. Stage by explicit path. Polish UI, English code. No `readonly` on props/types. Server actions use `updateTag`; Payload hooks use `revalidateTag`.

---

## File map

| File                                                  | Change                                                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/migrations/20260612_0_add_settled.ts`            | **Create** — add `settled` boolean column                                                                                                                              |
| `src/collections/transfers.ts`                        | **Modify** — `settled` checkbox field (after `cancelledTransaction`, `:230`)                                                                                           |
| `src/lib/calculate-margin.ts`                         | **Modify** — trailing `settled` param                                                                                                                                  |
| `src/lib/db/sum-transfers.ts`                         | **Modify** — `InvestmentFinancialsT`, `deriveFinancials`, `sumFilteredByType`, `sumCategoryBreakdown`, new `sumSettledCategoryBreakdown`, `sumAllInvestmentFinancials` |
| `src/lib/queries/reference-data.ts`                   | **Modify** — expose a `fetchSettledCategoryBreakdown` query                                                                                                            |
| `src/lib/map-category-costs.ts`                       | **Modify** — new `buildSettledFields()`                                                                                                                                |
| `src/components/investments/financial-stats.tsx`      | **Modify** — `settledFields` prop, orange block, margin math                                                                                                           |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`         | **Modify** — fetch + pass settled data                                                                                                                                 |
| `src/app/(frontend)/raporty/page.tsx`                 | **Modify** — fetch + pass settled data                                                                                                                                 |
| `src/lib/tables/transfers.tsx`                        | **Modify** — `settled` on `TransferRowT`, relabel/recolor cells                                                                                                        |
| `src/lib/schemas/transfer.ts`                         | **Modify** — `settled` in bulk server schema                                                                                                                           |
| `src/components/forms/expense-form/expense-schema.ts` | **Modify** — `settled` in client + server bulk schema                                                                                                                  |
| `src/components/forms/expense-form/expense-form.tsx`  | **Modify** — settled checkbox, thread to action payload                                                                                                                |
| `src/lib/actions/transfers.ts`                        | **Modify** — pass `settled` into `payload.create`                                                                                                                      |
| `src/__tests__/calculate-margin.test.ts`              | **Create/extend** — settled lowers margin                                                                                                                              |
| `src/__tests__/sum-transfers.test.ts`                 | **Extend** — settled excluded from materials/categories, surfaced as `totalSettled`                                                                                    |

**Decision — settled is form-level for the bulk expense form:** the bulk form submits N line items as N transactions sharing one type/source/investment. A single `settled` checkbox on the form applies to every line item in that submission (you log a batch of R+M materials together). Per-row correction after the fact is done via the Payload admin checkbox. This keeps `LineItemsField` untouched.

---

## Task 1: Migration — add the `settled` column

**Files:**

- Create: `src/migrations/20260612_0_add_settled.ts`

- [ ] **Step 1: Write the migration** (mirrors `20260611_1_add_loss_enum.ts`; a `boolean` column, not an enum value)

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written — migrate:create's snapshot baseline is stale on this branch
// (see AGENTS.md / project memory). `settled` flags an INVESTMENT_EXPENSE whose
// material is already priced into robocizna: leaves the register, excluded from
// bilans, reduces marża.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "settled" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "settled";
  `)
}
```

- [ ] **Step 2: Register the migration in the index**

Open `src/migrations/index.ts`. Follow the existing import + array-entry pattern (each migration is imported and listed). Add `20260612_0_add_settled` in chronological order **before** `20260611_*`? No — chronological means **after** the `20260611_*` entries. Match the surrounding style exactly.

- [ ] **Step 3: Apply locally + regenerate types**

Run: `pnpm payload migrate` then `pnpm generate:types`
Expected: migrate prints the new migration as run; `src/payload-types.ts` now has `settled?: boolean | null` on the transactions type.
**Do NOT `git add src/payload-types.ts`** (gitignored).

- [ ] **Step 4: Commit**

```bash
git add src/migrations/20260612_0_add_settled.ts src/migrations/index.ts
git commit -m "feat: add settled column to transactions"
```

---

## Task 2: Collection field — `settled` checkbox

**Files:**

- Modify: `src/collections/transfers.ts` (insert after the `cancelledTransaction` field block, ~`:230`)

- [ ] **Step 1: Add the field** (model on the existing `cancelled` checkbox at `:211-219`, but editable and conditional on type)

```ts
{
  name: 'settled',
  type: 'checkbox',
  defaultValue: false,
  label: { en: 'Included in labour (R+M)', pl: 'Wliczone w robociznę' },
  admin: {
    condition: (data) => data?.type === 'INVESTMENT_EXPENSE',
    description: {
      en: 'Material already priced into robocizna: leaves the register, reduces margin, NOT billed to the client.',
      pl: 'Materiał już zawarty w cenie robocizny: schodzi z kasy, obniża marżę, klient NIE płaci za niego osobno.',
    },
  },
},
```

No `access.update: () => false` — the flag must stay editable after the fact (for corrections/testing).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no usages reference `settled` yet).

- [ ] **Step 3: Commit**

```bash
git add src/collections/transfers.ts
git commit -m "feat: settled checkbox on investment expenses"
```

---

## Task 3: `calculateMargin` subtracts settled (TDD)

**Files:**

- Modify: `src/lib/calculate-margin.ts`
- Test: `src/__tests__/calculate-margin.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { calculateMargin } from '@/lib/calculate-margin'

describe('calculateMargin', () => {
  it('subtracts settled internal material from margin', () => {
    // robocizna 500, payouts 0, rabat 0, loss 0, settled 100 → 400
    expect(calculateMargin(500, 0, 0, 0, 100)).toBe(400)
  })

  it('defaults settled to 0 (existing callers unaffected)', () => {
    expect(calculateMargin(500, 0, 0, 0)).toBe(500)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts`
Expected: FAIL — first test returns 500 (settled arg ignored).

- [ ] **Step 3: Add the trailing param**

```ts
// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts are the company's already-withdrawn profit.
// A rabat is a discount on the labour price — the company's own cost — so it lowers margin.
// A loss (strata) is a cost the company absorbs itself — lowers margin, never touches bilans.
// Settled internal material is bought by the company but already priced into robocizna —
// it leaves the register and lowers margin, but is never billed to the client (off bilans).
// Margin = laborCosts - payouts - rabat - loss - settled = profit still available.
export const calculateMargin = (
  laborCosts: number,
  totalPayouts: number,
  rabat = 0,
  loss = 0,
  settled = 0,
) => laborCosts - totalPayouts - rabat - loss - settled
```

- [ ] **Step 4: Run it, verify it passes**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculate-margin.ts src/__tests__/calculate-margin.test.ts
git commit -m "feat: calculateMargin subtracts settled material"
```

---

## Task 4: SQL aggregation — exclude settled from bilans, surface `totalSettled` (TDD on derive)

**Files:**

- Modify: `src/lib/db/sum-transfers.ts`
- Test: `src/__tests__/sum-transfers.test.ts`

The mechanism: `sumFilteredByType` re-buckets settled rows under a pseudo-type
`INVESTMENT_EXPENSE_SETTLED`. Then `deriveFinancials` reads `INVESTMENT_EXPENSE`
(now settled-free) for materials and `INVESTMENT_EXPENSE_SETTLED` for the new bucket.
Category breakdowns get `AND settled IS NOT TRUE`, with a sibling query returning the
settled spend grouped by category for the split buttons.

- [ ] **Step 1: Write the failing test for `deriveFinancials`**

Add to `src/__tests__/sum-transfers.test.ts` (import `deriveFinancials` if not already):

```ts
describe('deriveFinancials — settled internal material', () => {
  it('keeps settled out of materials and surfaces it as totalSettled', () => {
    const byType = [
      { type: 'INVESTMENT_EXPENSE', total: 200 },
      { type: 'INVESTMENT_EXPENSE_SETTLED', total: 100 },
      { type: 'LABOR_COST', total: 500 },
      { type: 'INVESTOR_DEPOSIT', total: 1000 },
    ]
    const f = deriveFinancials(byType)
    expect(f.totalMaterialCosts).toBe(200) // settled NOT folded in
    expect(f.totalSettled).toBe(100)
    expect(f.settledCategoryCosts).toEqual([])
  })

  it('passes through settledCategoryCosts when provided', () => {
    const f = deriveFinancials([], [], [{ categoryId: 7, total: 100 }])
    expect(f.settledCategoryCosts).toEqual([{ categoryId: 7, total: 100 }])
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: FAIL — `totalSettled`/`settledCategoryCosts` undefined; `deriveFinancials` takes 2 args.

- [ ] **Step 3: Extend the type** (`InvestmentFinancialsT`, `:135-144`)

```ts
export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  totalMaterialCosts: number
  totalCorrections: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalRabat: number
  totalLoss: number
  totalSettled: number
  settledCategoryCosts: CategoryCostT[]
}
```

- [ ] **Step 4: Update `deriveFinancials`** (`:266-284`) — add a third arg and the two new fields

```ts
/** Derive financials (costs/income/labor) from type distribution. */
export function deriveFinancials(
  byType: TypeTotalT[],
  categoryCosts: CategoryCostT[] = [],
  settledCategoryCosts: CategoryCostT[] = [],
): InvestmentFinancialsT {
  return {
    categoryCosts,
    totalMaterialCosts:
      totalByType(byType, 'INVESTMENT_EXPENSE') + totalByType(byType, 'CORRECTION'),
    totalCorrections: totalByType(byType, 'CORRECTION'),
    totalIncome:
      totalByType(byType, 'INVESTOR_DEPOSIT') +
      totalByType(byType, 'COMPANY_FUNDING') +
      totalByType(byType, 'OTHER_DEPOSIT'),
    totalLaborCosts: totalByType(byType, 'LABOR_COST'),
    totalPayouts: totalByType(byType, 'PAYOUT'),
    totalRabat: totalByType(byType, 'RABAT'),
    totalLoss: totalByType(byType, 'LOSS'),
    totalSettled: totalByType(byType, 'INVESTMENT_EXPENSE_SETTLED'),
    settledCategoryCosts,
  }
}
```

- [ ] **Step 5: Re-bucket settled in `sumFilteredByType`** (`:295-319`) — change the SELECT so settled rows report a pseudo-type

```ts
const result = await db.execute(
  sql.raw(`
    SELECT
      CASE WHEN type = 'INVESTMENT_EXPENSE' AND settled IS TRUE
           THEN 'INVESTMENT_EXPENSE_SETTLED' ELSE type END AS type,
      COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE cancelled IS NOT TRUE
      ${conditions}
    GROUP BY 1
    ORDER BY total DESC
  `),
)
```

> Note: this also makes `deriveCostBreakdown().investmentExpenses` exclude settled — intended (settled is not an investor cost). The `totalFilteredAmount` sum in `transfer-table-server.tsx` is unaffected (it sums all buckets regardless of label).

- [ ] **Step 6: Exclude settled from the per-filter category breakdown** (`sumCategoryBreakdown`, `:216-242`) and add a settled sibling

In `sumCategoryBreakdown`, add `AND settled IS NOT TRUE` to the WHERE:

```ts
const result = await db.execute(
  sql.raw(`
      SELECT expense_category_id, COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE cancelled IS NOT TRUE
        AND type IN ('INVESTMENT_EXPENSE', 'CORRECTION')
        AND expense_category_id IS NOT NULL
        AND settled IS NOT TRUE
        ${conditions}
      GROUP BY expense_category_id
    `),
)
```

Then add a new exported query directly below it:

```ts
/**
 * SUM settled INVESTMENT_EXPENSE amounts grouped by expense_category_id, for the
 * out-of-bilans "Materiały wliczone w robociznę" split buttons.
 */
export const sumSettledCategoryBreakdown = async (
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
        AND type = 'INVESTMENT_EXPENSE'
        AND settled IS TRUE
        AND expense_category_id IS NOT NULL
        ${conditions}
      GROUP BY expense_category_id
    `),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.rows.map((row: any) => ({
    categoryId: Number(row.expense_category_id),
    total: Number(row.total),
  }))
}
```

- [ ] **Step 7: Update `sumAllInvestmentFinancials`** (`:150-210`) — exclude settled from costs/categories, add `total_settled`

Change the `total_costs` CASE and the category subquery WHERE, and add a settled sum:

```ts
        COALESCE(SUM(CASE WHEN type IN ('INVESTMENT_EXPENSE', 'CORRECTION') AND settled IS NOT TRUE THEN amount ELSE 0 END), 0) AS total_costs,
```

```ts
        COALESCE(SUM(CASE WHEN type = 'LOSS' THEN amount ELSE 0 END), 0) AS total_loss,
        COALESCE(SUM(CASE WHEN type = 'INVESTMENT_EXPENSE' AND settled IS TRUE THEN amount ELSE 0 END), 0) AS total_settled
```

In the category subquery (`:171-180`) add `AND settled IS NOT TRUE` before `GROUP BY`. Then in the `map.set(...)` builder (`:197-206`) add:

```ts
      totalLoss: Number(row.total_loss),
      totalSettled: Number(row.total_settled),
      settledCategoryCosts: [], // list view shows the aggregate only, not the split
```

- [ ] **Step 8: Run the tests, verify they pass**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: PASS. Fix any other test in this file that constructs `InvestmentFinancialsT` literals (they now need `totalSettled` + `settledCategoryCosts`).

- [ ] **Step 9: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "feat: aggregate settled material as totalSettled, off bilans"
```

---

## Task 5: Query layer — expose the settled category breakdown

**Files:**

- Modify: `src/lib/queries/reference-data.ts`

`reference-data.ts` already wraps `sumCategoryBreakdown` as `fetchCategoryBreakdown` and `sumFilteredByType` as `fetchFilteredByType` (cached). Mirror that for the new query.

- [ ] **Step 1: Add `fetchSettledCategoryBreakdown`**

Find `fetchCategoryBreakdown` in the file and add a sibling immediately after it, copying its exact caching/signature shape (same `unstable_cache` tags, same `getPayload` setup) but calling `sumSettledCategoryBreakdown`. Import `sumSettledCategoryBreakdown` from `@/lib/db/sum-transfers`.

> If `fetchCategoryBreakdown` is a thin wrapper like
> `export const fetchSettledCategoryBreakdown = (where: Where) => sumSettledCategoryBreakdown(payload, where)`
> match whatever pattern is there exactly — do not invent a different caching strategy.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/reference-data.ts
git commit -m "feat: fetchSettledCategoryBreakdown query"
```

---

## Task 6: `buildSettledFields` — labelled orange fields

**Files:**

- Modify: `src/lib/map-category-costs.ts`

- [ ] **Step 1: Add the builder** (reuses `costForCategory`; positive `amount` for display; only non-zero categories)

```ts
/** Build labelled fields for settled internal material, split per expense category.
 *  Positive amounts (display only) — these live OUTSIDE the bilans toggle sum. */
export function buildSettledFields(
  settledCategoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(settledCategoryCosts, cat.id) }))
    .filter(({ total }) => total !== 0)
    .map(({ cat, total }) => ({ label: cat.name, value: formatPLN(total), amount: total }))
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/map-category-costs.ts
git commit -m "feat: buildSettledFields for split-by-category display"
```

---

## Task 7: `FinancialStats` — orange out-of-bilans block + margin

**Files:**

- Modify: `src/components/investments/financial-stats.tsx`

- [ ] **Step 1: Add the prop and a section header constant**

Add to imports nothing new (StatButton already imported). Add prop + derive total:

```ts
import type { FinancialFieldT } from '@/types/export'
// ...
type FinancialStatsPropsT = {
  fields: FinancialFieldT[]
  totalLaborCosts: number
  totalPayouts?: number
  totalRabat?: number
  totalLoss?: number
  settledFields?: FinancialFieldT[]
}

export function FinancialStats({
  fields,
  totalLaborCosts,
  totalPayouts = 0,
  totalRabat = 0,
  totalLoss = 0,
  settledFields = [],
}: FinancialStatsPropsT) {
```

- [ ] **Step 2: Compute settled total and feed margin** (replace the `margin` line, `:73`)

```ts
const totalSettled = settledFields.reduce((sum, f) => sum + f.amount, 0)
const margin = calculateMargin(totalLaborCosts, totalPayouts, totalRabat, totalLoss, totalSettled)
```

- [ ] **Step 3: Render the block** — insert between the Strata block (`:85-89`) and the admin block (`:91`)

```tsx
{
  settledFields.length > 0 && (
    <div className="text-muted-foreground space-y-1 text-sm">
      <p className="text-xs">Materiały wliczone w robociznę</p>
      {settledFields.map((f) => (
        <StatButton key={f.label} label={f.label} value={f.value} className="border-chart-orange" />
      ))}
    </div>
  )
}
```

> This block sits OUTSIDE `ToggleStatButtons`, so it never enters the bilans sum — that is the visual proof it's not billed to the investor. It is visible to all roles (the figure isn't admin-secret like marża); if the client decides it should be admin-only, wrap it in `isAdminOrOwnerRole(userRole)` like the Wypłaty block.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/financial-stats.tsx
git commit -m "feat: settled material block in financial stats"
```

---

## Task 8: Wire settled data through the two pages

**Files:**

- Modify: `src/app/(frontend)/raporty/page.tsx`
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx`

- [ ] **Step 1: raporty — fetch + pass**

In `raporty/page.tsx`: import `fetchSettledCategoryBreakdown` and `buildSettledFields`. Add the fetch to the existing `Promise.all` (`:36-40`):

```ts
const [refData, typeDistribution, categoryBreakdown, settledBreakdown] = await Promise.all([
  fetchReferenceData(),
  fetchFilteredByType(statsWhere),
  fetchCategoryBreakdown(statsWhere),
  fetchSettledCategoryBreakdown(statsWhere),
])
```

Pass `settledBreakdown` into derive (`:43`) and build fields, then pass to `FinancialStats` (`:53-59`):

```ts
const financials = deriveFinancials(typeDistribution, categoryBreakdown, settledBreakdown)
const financialFields = buildFinancialFields(financials, refData.expenseCategories)
const settledFields = buildSettledFields(financials.settledCategoryCosts, refData.expenseCategories)
```

```tsx
<FinancialStats
  fields={financialFields}
  totalLaborCosts={financials.totalLaborCosts}
  totalPayouts={financials.totalPayouts}
  totalRabat={financials.totalRabat}
  totalLoss={financials.totalLoss}
  settledFields={settledFields}
/>
```

- [ ] **Step 2: investment detail — same wiring**

Open `src/app/(frontend)/inwestycje/[id]/page.tsx`. Find where it calls `deriveFinancials` and renders `<FinancialStats>`. Add the same `fetchSettledCategoryBreakdown(...)` (with the same `where`/investment filter that page already uses for `fetchCategoryBreakdown`), pass it as the third arg to `deriveFinancials`, build `settledFields` with `buildSettledFields`, and pass `settledFields` to `<FinancialStats>`. Match the page's existing fetch/derive structure exactly.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/raporty/page.tsx" "src/app/(frontend)/inwestycje/[id]/page.tsx"
git commit -m "feat: surface settled material block on raporty + investment pages"
```

---

## Task 9: Investments list — pass settled into its margin

**Files:**

- Modify: whichever component renders the per-investment list margin (find it).

- [ ] **Step 1: Find every `calculateMargin` caller**

Run: `grep -rn "calculateMargin(" src --include=*.ts --include=*.tsx`
Expected: the two pages route through `FinancialStats` (already handled in Task 7). Any OTHER caller (e.g. an investments-list row/summary using `sumAllInvestmentFinancials`) must pass `financials.totalSettled` as the 5th arg so the listed margin matches the detail page.

- [ ] **Step 2: For each remaining caller, thread totalSettled**

For a call like `calculateMargin(f.totalLaborCosts, f.totalPayouts, f.totalRabat, f.totalLoss)`, change to:

```ts
calculateMargin(f.totalLaborCosts, f.totalPayouts, f.totalRabat, f.totalLoss, f.totalSettled)
```

If a list row also displays a costs/materials figure derived from `totalMaterialCosts`, confirm it now excludes settled (it does — Task 4 removed settled from `total_costs`). No further change needed.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add <each modified file by explicit path>
git commit -m "feat: settled material in investments list margin"
```

---

## Task 10: Transfers table — relabel + recolor settled rows

**Files:**

- Modify: `src/lib/tables/transfers.tsx`

- [ ] **Step 1: Add `settled` to `TransferRowT`** (after `cancelled`, `:49`)

```ts
cancelled: boolean
settled: boolean
```

- [ ] **Step 2: Populate it in BOTH `mapTransferRow` branches** (after each `cancelled:` line, `:120` and `:150`)

```ts
      cancelled: doc.cancelled ?? false,
      settled: doc.settled ?? false,
```

(repeat the `settled: doc.settled ?? false,` in the second branch too — both objects must set it.)

- [ ] **Step 3: Add a label constant** near the top imports — reuse the Polish display string

Add below the imports:

```ts
const SETTLED_TYPE_LABEL = 'Materiały wliczone w robociznę'
```

- [ ] **Step 4: Recolor the amount cell** (`:202-213`) — settled uses orange

```tsx
    cell: (info) => {
      const { type, cancelled, settled } = info.row.original
      const isMuted = cancelled || type === 'CANCELLATION'
      const color = settled ? 'chart-orange' : TRANSFER_TYPE_COLORS[type]
      return (
        <span
          className="font-medium"
          style={isMuted ? undefined : { color: `var(--color-${color})` }}
        >
          {formatPLN(info.getValue())}
        </span>
      )
    },
```

- [ ] **Step 5: Relabel the type cell** (`:229-233`)

```tsx
  col.accessor('type', {
    id: 'type',
    header: 'Typ',
    cell: (info) =>
      info.row.original.settled
        ? SETTLED_TYPE_LABEL
        : (TRANSFER_TYPE_LABELS[info.getValue() as TransferTypeT] ?? info.getValue()),
  }),
```

The `expenseCategory` column is untouched — budowlane/wykończeniowe still shows per row, so both dimensions are visible at once.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tables/transfers.tsx
git commit -m "feat: relabel + recolor settled rows in transfers table"
```

---

## Task 11: Expense form — settled checkbox end-to-end

**Files:**

- Modify: `src/lib/schemas/transfer.ts` (server bulk schema)
- Modify: `src/components/forms/expense-form/expense-schema.ts` (client + server bulk)
- Modify: `src/components/forms/expense-form/expense-form.tsx`
- Modify: `src/lib/actions/transfers.ts`

- [ ] **Step 1: Add `settled` to the server bulk schema** — `createBulkExpenseSchema` in `expense-schema.ts` (`:95-115`)

Add to the top-level object (alongside `worker`):

```ts
    worker: z.number().optional(),
    settled: z.boolean().optional().default(false),
```

And to the client `bulkExpenseFormSchema` (`:51-61`) add:

```ts
    worker: z.string(),
    settled: z.boolean().optional().default(false),
```

- [ ] **Step 2: Add `settled` to the form default values + payload mapping** in `expense-form.tsx`

In `FormValuesT` (`:50-65`) add `settled: boolean`. In `defaultValues` (`:99-116`) add `settled: false,`. In the `onSubmit` `data` object (`:126-144`) add `settled: value.settled,` at the top level (it applies to every line item in this submission):

```ts
      const data: CreateBulkExpenseFormT = {
        date: value.date,
        type,
        // ...
        worker: value.worker ? Number(value.worker) : undefined,
        settled: value.settled,
        lineItems: value.lineItems.map((item) => ({
```

- [ ] **Step 3: Render the checkbox** — only for `INVESTMENT_EXPENSE`, near the investment field (`:222-228`)

Use the form's checkbox field component. Inspect a sibling for the exact API — the codebase uses `form.AppField` with a typed `field.*` renderer (e.g. `field.Checkbox`). If a `Checkbox` renderer exists on `field`, use it; otherwise follow the pattern used by `cancelled`-style booleans elsewhere. Insert:

```tsx
{
  currentType === 'INVESTMENT_EXPENSE' && (
    <form.AppField name="settled">
      {(field) => (
        <field.Checkbox label="Wliczone w robociznę (materiał w cenie robocizny — nie obciąża klienta)" />
      )}
    </form.AppField>
  )
}
```

> Verify `field.Checkbox` exists (grep `Checkbox` under `src/components/forms/`). If the renderer has a different name/prop shape, match it. Add `'settled'` to `resetConditionalFields`' `conditionalFields` list so switching away from INVESTMENT_EXPENSE clears it.

- [ ] **Step 4: Thread `settled` into `payload.create`** — `createBulkTransferAction` in `actions/transfers.ts` (`:128-143`)

```ts
            data: {
              description: item.description,
              amount: item.amount,
              date: parsed.data.date,
              type: parsed.data.type,
              paymentMethod: parsed.data.paymentMethod,
              sourceRegister: parsed.data.sourceRegister,
              targetRegister: parsed.data.targetRegister,
              investment: parsed.data.investment,
              worker: parsed.data.worker,
              expenseCategory: item.expenseCategory,
              otherCategory: item.category,
              invoice: invoiceMediaIds?.[i],
              invoiceNote: item.invoiceNote,
              settled: parsed.data.type === 'INVESTMENT_EXPENSE' ? parsed.data.settled : false,
              createdBy: user.id,
            },
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/transfer.ts src/components/forms/expense-form/expense-schema.ts src/components/forms/expense-form/expense-form.tsx src/lib/actions/transfers.ts
git commit -m "feat: settled checkbox on the expense form"
```

---

## Task 12: Integration verification (manual + targeted unit)

**Files:** none (verification only).

- [ ] **Step 1: Run the touched unit tests**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts src/__tests__/sum-transfers.test.ts`
Expected: PASS.

- [ ] **Step 2: Regression against the recorded baseline** (`docs/plan-settled-expenses.md` — investment 31, „11 Listopada 40")

Pre-change baseline: **Bilans = −207 328,03 · Marża = 140 087,00**. In the running app, flag one existing `INVESTMENT_EXPENSE` of amount `X` on investment 31 as settled (via the Payload admin checkbox or by adding a new settled expense). Confirm:

- Marża drops by `X`.
- Bilans rises by `X` (less negative).
- The source register balance is unchanged relative to "the expense exists".
- The row appears in the transfers table relabelled „Materiały wliczone w robociznę" in orange, category column intact.
- A „Materiały wliczone w robociznę" orange button appears under the stats, split by category, and is NOT part of the Bilans toggle sum.

> Local login / temp OWNER + which investments are safe to touch: see project memory `project_local_login_and_test_fixtures.md`. Confirm before mutating local data — a `db:import` would wipe it.

- [ ] **Step 3: typecheck + lint final pass**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Run `simplify` on the changed code** (project rule — before final wrap-up)

Invoke the `simplify` skill over the diff; apply safe dedup, hold judgment calls as proposals.

> Do NOT run the full test suite or push without asking (pre-push hook runs typecheck + tests + db:dump).

---

## Self-review notes

- **Spec coverage:** flag data model (T1–T2), table relabel/recolor (T10), split-by-category out-of-bilans block (T6–T8), investments-list figure (T9), marża formula `…− settled` (T3, T7), bilans exclusion (T4). Sheets is explicitly out of scope (Phase 2).
- **Type consistency:** `InvestmentFinancialsT` gains `totalSettled` + `settledCategoryCosts` (T4) and every constructor is updated (T4 step 7, T4 step 8 fixes literals); `calculateMargin` 5th param `settled` used consistently (T3, T7, T9); `buildSettledFields` → `settledFields` prop on `FinancialStats` (T6, T7, T8); `fetchSettledCategoryBreakdown` wraps `sumSettledCategoryBreakdown` (T4, T5).
- **Known soft spot:** T11 step 3 depends on the form's checkbox renderer API (`field.Checkbox`) — the executor must verify the exact name against a sibling field before writing it. Flagged inline.
