# LOSS ("Strata") Transfer Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `LOSS` (Polish: "Strata") transfer type — a cost the company absorbs itself: reduces marża, never touches bilans, moves no cash, optionally linked to an investment.

**Architecture:** `LOSS` is a near-clone of `RABAT` (no source register, P&L-only). The single behavioral difference: `calculate-balance.ts` is untouched (`RABAT` raises bilans; `LOSS` must not). The load-bearing file is `src/lib/constants/transfers.ts` — its helpers drive the Payload validate hook, the Zod schemas, and the form, so most behavior falls out of the constants change. Verified during analysis: Sheets sync is automatically a no-op (`sync-sheet.ts` early-returns for any type ≠ `INVESTMENT_EXPENSE`); balance recalc hooks are register/investment-tag-driven and need no change; the cancel/create actions gate on `needsSourceRegister()` so they adapt automatically.

**Tech Stack:** Next.js, Payload CMS (Postgres enum migration), Vitest, Zod, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-11-loss-strata-transfer-type-design.md`

**Spec corrections found during analysis (incorporated below):**

1. The spec's blast radius omits `src/lib/queries/investments.ts` — `shapeInvestments()` computes `margin` for the investments table and must pass `totalLoss`; its zero-fallback financials object also needs `totalLoss: 0`.
2. `TRANSFER_TYPE_COLORS` in `src/lib/constants/transfers.ts` is an exhaustive `Record<TransferTypeT, string>` (colors the amount in the transfers table) — adding `LOSS` to the union forces a color entry there, beyond the stat-button color the spec mentions.
3. The spec points at `showSourceRegister`/`showInvestment` in `src/collections/transfers.ts`, but those only drive the Payload **admin UI**. The operative copies are `needsSourceRegister()` / `INVESTMENT_TYPES` / `REQUIRES_INVESTMENT_TYPES` in `src/lib/constants/transfers.ts`. Both must change.
4. Display color (left open in the spec): `chart-purple` (`#976cdf`, registered in `@theme` in `src/styles/globals.css:65`) — exists, unused by any transfer type, distinct from `chart-red` (reserved for investor costs).
5. No e2e suite exists in the repo (no Playwright config / e2e dir) — unit tests only, per user instruction.

---

### Task 1: Constants — `LOSS` in `src/lib/constants/transfers.ts` (TDD)

**Files:**

- Test (create): `src/__tests__/transfer-loss.test.ts`
- Test (modify): `src/__tests__/transfer-constants.test.ts`
- Modify: `src/lib/constants/transfers.ts`

- [x] **Step 1: Write the failing tests**

Create `src/__tests__/transfer-loss.test.ts` (mirrors `transfer-rabat.test.ts`):

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

describe('LOSS transfer type', () => {
  it('is a recognised transfer type with a Polish label', () => {
    expect(isTransferType('LOSS')).toBe(true)
    expect(TRANSFER_TYPE_LABELS.LOSS).toBe('Strata')
  })

  it('shows the investment field but does not require it (optional link)', () => {
    expect(showsInvestment('LOSS')).toBe(true)
    expect(requiresInvestment('LOSS')).toBe(false)
  })

  it('has no source register (like LABOR_COST and RABAT)', () => {
    expect(needsSourceRegister('LOSS')).toBe(false)
  })

  it('appears in the transaction transfer dialog', () => {
    expect(TRANSACTION_TRANSFER_TYPES).toContain('LOSS')
  })
})
```

Update `src/__tests__/transfer-constants.test.ts` truth table:

- `needsSourceRegister.trueFor` (line 28) becomes:
  ```ts
  trueFor: TRANSFER_TYPES.filter(
    (t) => t !== 'LABOR_COST' && t !== 'RABAT' && t !== 'LOSS',
  ) as string[],
  ```
  (also update its comment to mention LOSS)
- `showsInvestment.trueFor` (lines 32–41): add `'LOSS'` to the array.
- `TRANSACTION_TRANSFER_TYPES` exact-equality test (lines 76–83) becomes:

  ```ts
  expect(TRANSACTION_TRANSFER_TYPES).toEqual([
    'OTHER',
    'CORRECTION',
    'LABOR_COST',
    'RABAT',
    'LOSS',
    'INVESTMENT_EXPENSE',
    'PAYOUT',
  ])
  ```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/transfer-loss.test.ts src/__tests__/transfer-constants.test.ts`
Expected: FAIL — `isTransferType('LOSS')` is false, `TRANSFER_TYPE_LABELS.LOSS` undefined, list mismatch.

- [x] **Step 3: Implement in `src/lib/constants/transfers.ts`**

All lists stay sorted by Polish label — `Strata` sorts after `Rabat`.

1. `TRANSFER_TYPES`: insert `'LOSS', // Strata` between `'RABAT', // Rabat` and `'REGISTER_TRANSFER', // Transfer między kasami`.
2. `TRANSFER_TYPE_LABELS`: add `LOSS: 'Strata',` after the `RABAT` entry.
3. `TRANSFER_TYPE_COLORS`: add `LOSS: 'chart-purple',` after the `RABAT` entry.
4. `TRANSACTION_TRANSFER_TYPES`: insert `'LOSS', // Strata` between `'RABAT', // Rabat` and `'INVESTMENT_EXPENSE', // Wydatek inwestycyjny`.
5. `INVESTMENT_TYPES`: add `'LOSS',` (after `'RABAT',`). Do **NOT** add to `REQUIRES_INVESTMENT_TYPES` — investment is optional for LOSS.
6. `needsSourceRegister`:
   ```ts
   export const needsSourceRegister = (type: string) =>
     isTransferType(type) && type !== 'LABOR_COST' && type !== 'RABAT' && type !== 'LOSS'
   ```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/transfer-loss.test.ts src/__tests__/transfer-constants.test.ts src/__tests__/transfer-rabat.test.ts`
Expected: PASS (all three — rabat suite guards against regressions).

- [x] **Step 5: Commit**

```bash
git add src/lib/constants/transfers.ts src/__tests__/transfer-loss.test.ts src/__tests__/transfer-constants.test.ts
git commit -m "feat: add LOSS (Strata) transfer type to constants"
```

---

### Task 2: Payload collection + migration

**Files:**

- Modify: `src/collections/transfers.ts` (TRANSFER_TYPES at line 13, `showSourceRegister` at lines 31–33, `showInvestment` at lines 36–42)
- Create: `src/migrations/20260611_1_add_loss_enum.ts`
- Modify: `src/migrations/index.ts`

No unit test — Payload config + SQL migration; the validate hook it feeds is already covered via the constants tests (it delegates to `needsSourceRegister`/`requiresInvestment`).

- [x] **Step 1: Add the type to the collection config**

In `src/collections/transfers.ts`:

1. In `TRANSFER_TYPES`, after the `RABAT` entry (line 13), insert:
   ```ts
   { label: { en: 'Loss', pl: 'Strata' }, value: 'LOSS' },
   ```
2. Replace `showSourceRegister` (lines 31–33) with:
   ```ts
   /** Show sourceRegister for all types except LABOR_COST, RABAT and LOSS (P&L figures, no cash movement) */
   const showSourceRegister = (data: Record<string, unknown>) =>
     data?.type !== 'LABOR_COST' && data?.type !== 'RABAT' && data?.type !== 'LOSS'
   ```
3. In `showInvestment` (lines 36–42), add a line:
   ```ts
   data?.type === 'LOSS' ||
   ```
   (order doesn't matter; keep it next to `'RABAT'`).

- [x] **Step 2: Create the migration**

Per AGENTS.md, hand-write it (never `pnpm migrate:create`). Create `src/migrations/20260611_1_add_loss_enum.ts`:

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (mirrors 20260611_add_rabat_enum) — migrate:create's snapshot
// baseline is stale on this branch (see AGENTS.md / project memory).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE enum_transactions_type ADD VALUE IF NOT EXISTS 'LOSS';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing enum values — no-op
}
```

(`_1_` infix keeps the name unique alongside same-day `20260611_add_rabat_enum`, matching the `20260222_0_…` precedent.)

- [x] **Step 3: Register the migration**

In `src/migrations/index.ts`, after the `20260611_add_rabat_enum` import (line 37):

```ts
import * as migration_20260611_1_add_loss_enum from './20260611_1_add_loss_enum'
```

…and append to the `migrations` array after the rabat entry (line 224):

```ts
{
  up: migration_20260611_1_add_loss_enum.up,
  down: migration_20260611_1_add_loss_enum.down,
  name: '20260611_1_add_loss_enum',
},
```

- [x] **Step 4: Apply locally + regenerate types**

Run: `pnpm payload migrate` — applies the enum value to the local DB (additive `ALTER TYPE … ADD VALUE`, safe for live local data).
Expected output: `20260611_1_add_loss_enum` listed as migrated, no errors.

Run: `pnpm generate:types`
Expected: regenerates `src/payload-types.ts` (gitignored — do NOT `git add` it). The `Transaction['type']` union now includes `'LOSS'`.

- [x] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: clean (nothing consumes the new union member yet).

```bash
git add src/collections/transfers.ts src/migrations/20260611_1_add_loss_enum.ts src/migrations/index.ts
git commit -m "feat: add LOSS to transactions collection and type enum migration"
```

---

### Task 3: Aggregation — `totalLoss` through the data layer (TDD)

**Files:**

- Test (modify): `src/__tests__/sum-transfers.test.ts`
- Test (modify): `src/__tests__/calculate-balance.test.ts`
- Modify: `src/lib/db/sum-transfers.ts`
- Modify: `src/lib/queries/investments.ts` (fallback object only — margin wiring is Task 4)

- [x] **Step 1: Write the failing tests**

In `src/__tests__/sum-transfers.test.ts`:

1. `sumAllInvestmentFinancials` → "returns a Map of investment financials" (lines 119–164): add `total_loss: '120'` to the first mocked row and `total_loss: '0'` to the second; add `totalLoss: 120` / `totalLoss: 0` to the corresponding `toEqual` objects.
2. `deriveFinancials` → "derives totals from type distribution" (lines 288–305): add `{ type: 'LOSS', total: 150 }` to `byType` and `totalLoss: 150` to the expected object.
3. `deriveFinancials` → "returns zeros for empty array" (lines 307–317): add `totalLoss: 0` to the expected object.

In `src/__tests__/calculate-balance.test.ts`:

1. Add `totalLoss: 0,` to the `base` object (line 5–13) — required once `InvestmentFinancialsT` gains the field.
2. Add the regression test that pins THE design decision (bilans ignores LOSS):

```ts
it('ignores losses — strata is the company cost, not the investor cost', () => {
  expect(
    calculateBalance({
      ...base,
      totalIncome: 10000,
      totalMaterialCosts: 3000,
      totalLaborCosts: 2000,
      totalLoss: 1500,
    }),
  ).toBe(5000)
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts src/__tests__/calculate-balance.test.ts`
Expected: FAIL — `toEqual` mismatches (no `totalLoss` key in actual objects).

- [x] **Step 3: Implement in `src/lib/db/sum-transfers.ts`**

1. `InvestmentFinancialsT` (lines 135–143): add `totalLoss: number` after `totalRabat`.
2. `sumAllInvestmentFinancials` totals SQL (after the `total_rabat` line, line 163):
   ```sql
   COALESCE(SUM(CASE WHEN type = 'LOSS' THEN amount ELSE 0 END), 0) AS total_loss
   ```
   (comma after the `total_rabat` line).
3. Row mapping (after line 202): `totalLoss: Number(row.total_loss),`
4. `deriveFinancials` (lines 263–280): add `totalLoss: totalByType(byType, 'LOSS'),`

In `src/lib/queries/investments.ts`, add `totalLoss: 0,` to the fallback financials object (lines 24–32) — without this, typecheck fails.

- [x] **Step 4: Run tests + typecheck to verify they pass**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts src/__tests__/calculate-balance.test.ts && pnpm typecheck`
Expected: PASS / clean.

- [x] **Step 5: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/lib/queries/investments.ts src/__tests__/sum-transfers.test.ts src/__tests__/calculate-balance.test.ts
git commit -m "feat: aggregate totalLoss in investment financials"
```

---

### Task 4: Margin — `loss` parameter + investments-table wiring (TDD)

**Files:**

- Test (modify): `src/__tests__/calculate-margin.test.ts`
- Modify: `src/lib/calculate-margin.ts`
- Modify: `src/lib/queries/investments.ts:44-48`

- [x] **Step 1: Write the failing tests**

Append to `src/__tests__/calculate-margin.test.ts`:

```ts
it('subtracts the loss from the margin', () => {
  expect(calculateMargin(5000, 1000, 0, 700)).toBe(3300)
})

it('subtracts both rabat and loss', () => {
  expect(calculateMargin(5000, 1000, 800, 700)).toBe(2500)
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts`
Expected: FAIL — 4th argument ignored, `3300 !== 4000` / `2500 !== 3200`.

- [x] **Step 3: Implement**

Replace `src/lib/calculate-margin.ts`:

```ts
// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts are the company's already-withdrawn profit.
// A rabat is a discount on the labour price — the company's own cost — so it lowers margin.
// A loss (strata) is a cost the company absorbs itself — lowers margin, never touches bilans.
// Margin = laborCosts - payouts - rabat - loss = profit still available.
export const calculateMargin = (laborCosts: number, totalPayouts: number, rabat = 0, loss = 0) =>
  laborCosts - totalPayouts - rabat - loss
```

In `src/lib/queries/investments.ts`, `shapeInvestments()` margin call (lines 44–48) — pass the loss:

```ts
margin: calculateMargin(
  financials.totalLaborCosts,
  financials.totalPayouts,
  financials.totalRabat,
  financials.totalLoss,
),
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts && pnpm typecheck`
Expected: PASS / clean.

- [x] **Step 5: Commit**

```bash
git add src/lib/calculate-margin.ts src/lib/queries/investments.ts src/__tests__/calculate-margin.test.ts
git commit -m "feat: subtract loss (strata) from margin"
```

---

### Task 5: Display — Strata stat + page wiring

**Files:**

- Modify: `src/components/investments/financial-stats.tsx`
- Modify: `src/app/(frontend)/raporty/page.tsx:53-58`
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx:83-88`

No component test — the repo has no component-test setup; the margin math is covered in Task 4.

- [x] **Step 1: Extend `FinancialStats`**

In `src/components/investments/financial-stats.tsx`:

1. Props type + destructuring:
   ```ts
   type FinancialStatsPropsT = {
     fields: FinancialFieldT[]
     totalLaborCosts: number
     totalPayouts?: number
     totalRabat?: number
     totalLoss?: number
   }
   ```
   …and `totalLoss = 0` in the destructured parameters.
2. Margin (line 71): `const margin = calculateMargin(totalLaborCosts, totalPayouts, totalRabat, totalLoss)`
3. Render the Strata stat between `<ToggleStatButtons />` and the admin/owner block — visible to ALL page viewers (managers included, per spec; the marża stays inside the role gate). Rendered only when non-zero, mirroring how `buildFinancialFields` hides zero Rabat/Korekty:
   ```tsx
   {
     totalLoss !== 0 && (
       <div className="text-muted-foreground mb-4 space-y-1 text-sm">
         <StatButton label="Strata" value={formatPLN(totalLoss)} className="border-chart-purple" />
       </div>
     )
   }
   ```

Deliberately NOT added to `buildFinancialFields` (`src/lib/map-category-costs.ts`) — keeps Strata out of the bilans toggle sum and the client-facing export, exactly like Wypłaty.

- [x] **Step 2: Wire both call sites**

In `src/app/(frontend)/raporty/page.tsx` and `src/app/(frontend)/inwestycje/[id]/page.tsx`, add to the `<FinancialStats>` props:

```tsx
totalLoss={financials.totalLoss}
```

- [x] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [x] **Step 4: Commit**

```bash
git add src/components/investments/financial-stats.tsx "src/app/(frontend)/raporty/page.tsx" "src/app/(frontend)/inwestycje/[id]/page.tsx"
git commit -m "feat: show Strata stat and feed loss into margin display"
```

---

### Task 6: Docs + full verification

**Files:**

- Modify: `AGENTS.md` (Transfer Business Logic — non-obvious rules list)
- Modify: `docs/investment-financials-and-discount.md` (marża formula)

- [x] **Step 1: Update AGENTS.md**

In the "Transfer Business Logic" non-obvious rules list, after the `RABAT` bullet, add:

```md
- `LOSS` (strata) is a company-absorbed cost: **no source register**, positive amount, investment **optional**. It only lowers `marża` (`marża = robocizna − wypłaty − rabat − strata`); `bilans` is untouched — unlike `RABAT`, which moves both.
```

…and update the LABOR_COST bullet's margin formula if it spells one out (`marża = robocizna − wypłaty − rabat` → `marża = robocizna − wypłaty − rabat − strata`).

- [x] **Step 2: Update the financials doc**

In `docs/investment-financials-and-discount.md`, update the marża formula to include `− strata` and add a short LOSS section mirroring the RABAT one (read the doc first; keep its structure). State the one-line contrast: RABAT moves marża AND bilans; LOSS moves only marża.

- [x] **Step 3: Full test suite + typecheck + lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green.

- [x] **Step 4: Commit**

```bash
git add AGENTS.md docs/investment-financials-and-discount.md docs/superpowers/plans/2026-06-11-loss-strata-transfer-type.md
git commit -m "docs: document LOSS (Strata) transfer type"
```
