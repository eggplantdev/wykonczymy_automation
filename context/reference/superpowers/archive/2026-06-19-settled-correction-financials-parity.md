# Settled Corrections + Investment-Financials Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `settled` (wliczone w robociznę) flag work symmetrically on `CORRECTION` rows, and collapse the listing and detail financial-aggregation paths onto one shared classifier so they can never diverge.

**Architecture:** SQL becomes "dumb" — it only sums raw amounts grouped by `(type, settled[, investment])`. One JS function (`deriveFinancials`) holds the entire bucketing rule (which type+settled goes to materiały / marża / bilans). The listing path (`sumAllInvestmentFinancials`) and the detail path (`sumFilteredByType` → `deriveFinancials`) both feed that one function, so by construction they return identical figures. A read-only snapshot tool captures every investment's figures via both paths before and after, proving no regression.

**Tech Stack:** Next.js 15 + Payload CMS, `@payloadcms/db-vercel-postgres` (Drizzle `db.execute(sql...)`), Vitest, TanStack Form, Zod, local Docker Postgres on port 5433.

## Global Constraints

- Polish UI, English code/comments. (AGENTS.md)
- Never run SQL/migrations against Neon (`DB_POSTGRES_URL_PROD`); local Docker only (`DB_POSTGRES_URL`). The snapshot tool is **read-only**. (AGENTS.md)
- Do NOT add `readonly` to types/props/params. (AGENTS.md)
- `prefer type over interface`; suffix shared types with `T`. (global TS rules)
- Single test file run: `pnpm exec vitest run src/__tests__/<file>.test.ts` (pnpm 10 won't forward `--`). (AGENTS.md)
- `payload-types.ts` is gitignored — never `git add` it. (AGENTS.md)
- Commit only the files each task touches, by explicit path. Never `git push`. (user git rules)
- No schema/migration change expected — the `settled` column already exists (`src/migrations/20260612_0_add_settled.ts`).

---

## File Structure

**New:**

- `scripts/audit-investment-parity.ts` — read-only snapshot/outlier tool (boots Payload, runs both paths per investment, writes JSON+CSV).
- `src/lib/investment-figures.ts` — pure `extractFigures(financials)` helper: turns an `InvestmentFinancialsT` into the six display figures. Shared by the snapshot tool and the parity test. Keeps the "six figures" definition in one place.
- `src/__tests__/investment-figures.test.ts` — unit test for `extractFigures`.
- `src/__tests__/investment-financials-parity.test.ts` — the parity guard: same synthetic data through both paths → equal figures.

**Modified:**

- `src/lib/db/sum-transfers.ts` — new `TypeSettledTotalT`; rewrite `deriveFinancials` + `deriveCostBreakdown` to consume settled-aware rows; rewrite `sumFilteredByType` and `sumAllInvestmentFinancials` to emit/consume raw `(type, settled)` sums.
- `src/__tests__/sum-transfers.test.ts` — update fixtures/asserts to the new row shape and JS-side settled bucketing.
- `src/lib/queries/reference-data.ts` — update `fetchFilteredByType` return type to `TypeSettledTotalT[]`.
- `src/lib/actions/transfers.ts:142` — allow `settled` for `CORRECTION`.
- `src/components/forms/expense-form/expense-form.tsx:225` — show the settled checkbox for `CORRECTION`.
- `src/collections/transfers.ts:237` — widen the `settled` field `admin.condition` to `CORRECTION`.
- `src/hooks/transfers/validate.ts` — guard: clear `settled` for any type other than `INVESTMENT_EXPENSE`/`CORRECTION`.

---

## Phase 0 — Baseline snapshot tool (read-only, no production behavior change)

### Task 0.1: `extractFigures` pure helper

**Files:**

- Create: `src/lib/investment-figures.ts`
- Test: `src/__tests__/investment-figures.test.ts`

**Interfaces:**

- Consumes: `InvestmentFinancialsT`, `calculateBalance`, `calculateMargin` (existing).
- Produces: `type InvestmentFiguresT = { bilans: number; marza: number; materialy: number; wydatkiInwestycyjne: number; wyplaty: number; settled: number }` and `extractFigures(financials: InvestmentFinancialsT): InvestmentFiguresT`. Used by Task 0.2 and Task 1.4.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/investment-figures.test.ts
import { describe, it, expect } from 'vitest'
import { extractFigures } from '@/lib/investment-figures'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalCorrections: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
  totalLoss: 0,
  totalSettled: 0,
  settledCategoryCosts: [],
}

describe('extractFigures', () => {
  it('derives the six display figures from financials', () => {
    const fin: InvestmentFinancialsT = {
      ...base,
      categoryCosts: [
        { categoryId: 1, total: 3000 },
        { categoryId: 2, total: 2000 },
      ],
      totalMaterialCosts: 5000,
      totalIncome: 12000,
      totalLaborCosts: 800,
      totalPayouts: 300,
      totalRabat: 200,
      totalLoss: 150,
      totalSettled: 100,
    }
    expect(extractFigures(fin)).toEqual({
      // bilans = income - (materialy + labor) + rabat = 12000 - 5800 + 200
      bilans: 6400,
      // marza = labor - payouts - rabat - loss - settled = 800 - 300 - 200 - 150 - 100
      marza: 50,
      materialy: 5000,
      // wydatki inwestycyjne = sum of categoryCosts
      wydatkiInwestycyjne: 5000,
      wyplaty: 300,
      settled: 100,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/investment-figures.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/investment-figures"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/investment-figures.ts
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'
import { calculateBalance } from '@/lib/calculate-balance'
import { calculateMargin } from '@/lib/calculate-margin'

// The six per-investment figures shown on both the listing and the detail page.
export type InvestmentFiguresT = {
  bilans: number
  marza: number
  materialy: number
  wydatkiInwestycyjne: number
  wyplaty: number
  settled: number
}

export function extractFigures(financials: InvestmentFinancialsT): InvestmentFiguresT {
  return {
    bilans: calculateBalance(financials),
    marza: calculateMargin(
      financials.totalLaborCosts,
      financials.totalPayouts,
      financials.totalRabat,
      financials.totalLoss,
      financials.totalSettled,
    ),
    materialy: financials.totalMaterialCosts,
    wydatkiInwestycyjne: financials.categoryCosts.reduce((sum, c) => sum + c.total, 0),
    wyplaty: financials.totalPayouts,
    settled: financials.totalSettled,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/investment-figures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/investment-figures.ts src/__tests__/investment-figures.test.ts
git commit -m "feat(investments): extractFigures helper for the six per-investment figures"
```

---

### Task 0.2: Read-only snapshot/outlier script

**Files:**

- Create: `scripts/audit-investment-parity.ts`

**Interfaces:**

- Consumes: `getPayload`, `fetchReferenceData`, `sumAllInvestmentFinancials`, `sumFilteredByType`, `sumCategoryBreakdown`, `sumSettledCategoryBreakdown`, `deriveFinancials`, `extractFigures`.
- Produces: two files per run — `dumps/parity-<label>.json` and `dumps/parity-<label>.csv` — and a console list of outliers (where listing figures ≠ detail figures).

> This task has no unit test — it is a manual, DB-driven script. Verification = running it (Step 3) and eyeballing the output. The pure logic it relies on (`extractFigures`, comparison) is tested in Task 0.1 and Task 1.4.

- [ ] **Step 1: Confirm the local DB is the Docker copy, not Neon**

Run: `docker compose up -d` (starts local Postgres on 5433) and confirm `.env` `DB_POSTGRES_URL` points at `localhost:5433` / `wykonczymy-db`. Do NOT proceed if it points at Neon.

- [ ] **Step 2: Write the script**

```ts
// scripts/audit-investment-parity.ts
//
// READ-ONLY. Computes the six per-investment figures via BOTH the listing path
// (sumAllInvestmentFinancials) and the detail path (sumFilteredByType + breakdowns
// -> deriveFinancials), diffs them, and writes JSON + CSV to dumps/.
//
// Usage: pnpm tsx scripts/audit-investment-parity.ts before
//        pnpm tsx scripts/audit-investment-parity.ts after
import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryBreakdown,
  sumSettledCategoryBreakdown,
  deriveFinancials,
} from '@/lib/db/sum-transfers'
import { extractFigures, type InvestmentFiguresT } from '@/lib/investment-figures'

const round2 = (n: number) => Math.round(n * 100) / 100
const FIGURE_KEYS: (keyof InvestmentFiguresT)[] = [
  'bilans',
  'marza',
  'materialy',
  'wydatkiInwestycyjne',
  'wyplaty',
  'settled',
]

async function main() {
  const label = process.argv[2] ?? 'snapshot'
  const payload = await getPayload({ config })
  const { investments } = await fetchReferenceData()

  const listingMap = await sumAllInvestmentFinancials(payload)

  const rows = []
  for (const inv of investments) {
    const where = { investment: { equals: inv.id } }
    const [byType, cats, settledCats] = await Promise.all([
      sumFilteredByType(payload, where),
      sumCategoryBreakdown(payload, where),
      sumSettledCategoryBreakdown(payload, where),
    ])
    const detailFin = deriveFinancials(byType, cats, settledCats)
    const listingFin = listingMap.get(inv.id)

    const detail = extractFigures(detailFin)
    const listing = listingFin
      ? extractFigures(listingFin)
      : (Object.fromEntries(FIGURE_KEYS.map((k) => [k, 0])) as InvestmentFiguresT)

    const diffs = FIGURE_KEYS.filter((k) => round2(listing[k]) !== round2(detail[k]))
    rows.push({ id: inv.id, name: inv.name, listing, detail, match: diffs.length === 0, diffs })
  }

  writeFileSync(`dumps/parity-${label}.json`, JSON.stringify(rows, null, 2))

  const header = [
    'id',
    'name',
    ...FIGURE_KEYS.flatMap((k) => [`${k}_listing`, `${k}_detail`]),
    'match',
  ].join(',')
  const csvLines = rows.map((r) =>
    [
      r.id,
      `"${r.name.replace(/"/g, '""')}"`,
      ...FIGURE_KEYS.flatMap((k) => [round2(r.listing[k]), round2(r.detail[k])]),
      r.match ? 'TAK' : 'NIE',
    ].join(','),
  )
  writeFileSync(`dumps/parity-${label}.csv`, [header, ...csvLines].join('\n'))

  const outliers = rows.filter((r) => !r.match)
  console.log(`\n${rows.length} investments. Outliers: ${outliers.length}`)
  for (const o of outliers) {
    console.log(`  #${o.id} ${o.name} — differs on: ${o.diffs.join(', ')}`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Run it to produce the "before" baseline**

Run: `pnpm tsx scripts/audit-investment-parity.ts before`
Expected: prints investment count + outlier list; writes `dumps/parity-before.json` and `dumps/parity-before.csv`.
If `pnpm tsx` is unavailable, check `package.json` for an existing script runner (the repo runs ad-hoc Local API scripts) and use that invocation instead.

- [ ] **Step 4: Record findings**

If outliers > 0, STOP and report them to the user before any production change — those are existing settled-CORRECTION (or other) divergences whose values will move in Phase 1. Do not silently change them.

- [ ] **Step 5: Commit the tool + baseline**

```bash
git add scripts/audit-investment-parity.ts dumps/parity-before.json dumps/parity-before.csv
git commit -m "chore(investments): read-only parity snapshot tool + before baseline"
```

(If `dumps/` is gitignored, commit only the script and keep the baseline files locally; note their path in the PR.)

---

## Phase 1 — Single source of truth (variant 2c), behavior-preserving for existing data

### Task 1.1: Settled-aware `deriveFinancials` / `deriveCostBreakdown`

**Files:**

- Modify: `src/lib/db/sum-transfers.ts` (`deriveFinancials` `:306-327`, `deriveCostBreakdown` `:330-336`, add `TypeSettledTotalT`)
- Test: `src/__tests__/sum-transfers.test.ts` (`deriveFinancials` / `deriveCostBreakdown` blocks)
- Test: `src/__tests__/investment-financials-parity.test.ts` (created in Task 1.4 — written here as the settled-CORRECTION driver)

**Interfaces:**

- Produces: `type TypeSettledTotalT = { type: string; settled: boolean; total: number }`. `deriveFinancials(rows: TypeSettledTotalT[], categoryCosts?: CategoryCostT[], settledCategoryCosts?: CategoryCostT[]): InvestmentFinancialsT`. `deriveCostBreakdown(rows: TypeSettledTotalT[]): CostBreakdownT`. Consumed by Tasks 1.2, 1.3, the detail page, and the snapshot tool.
- Note: the old `INVESTMENT_EXPENSE_SETTLED` synthetic type string is removed — settled-ness now rides on the `settled` field, not a re-bucketed type string.

- [ ] **Step 1: Rewrite the `deriveFinancials` test block to the new shape**

Replace the `describe('deriveFinancials', ...)` and `describe('deriveFinancials — settled internal material', ...)` blocks in `src/__tests__/sum-transfers.test.ts` with rows carrying `settled`:

```ts
describe('deriveFinancials', () => {
  it('derives totals from type+settled distribution', () => {
    const rows = [
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 5000 },
      { type: 'INVESTOR_DEPOSIT', settled: false, total: 12000 },
      { type: 'LABOR_COST', settled: false, total: 800 },
      { type: 'PAYOUT', settled: false, total: 300 },
      { type: 'RABAT', settled: false, total: 200 },
      { type: 'LOSS', settled: false, total: 150 },
    ]
    expect(deriveFinancials(rows)).toEqual({
      categoryCosts: [],
      totalMaterialCosts: 5000,
      totalCorrections: 0,
      totalIncome: 12000,
      totalLaborCosts: 800,
      totalPayouts: 300,
      totalRabat: 200,
      totalLoss: 150,
      totalSettled: 0,
      settledCategoryCosts: [],
    })
  })

  it('returns zeros for empty array', () => {
    expect(deriveFinancials([])).toEqual({
      categoryCosts: [],
      totalMaterialCosts: 0,
      totalCorrections: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      totalRabat: 0,
      totalLoss: 0,
      totalSettled: 0,
      settledCategoryCosts: [],
    })
  })
})

describe('deriveFinancials — settled material is symmetric for EXPENSE and CORRECTION', () => {
  it('keeps settled INVESTMENT_EXPENSE out of materials, into totalSettled', () => {
    const rows = [
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 200 },
      { type: 'INVESTMENT_EXPENSE', settled: true, total: 100 },
      { type: 'LABOR_COST', settled: false, total: 500 },
    ]
    const f = deriveFinancials(rows)
    expect(f.totalMaterialCosts).toBe(200)
    expect(f.totalSettled).toBe(100)
  })

  it('keeps settled CORRECTION out of materials/corrections, into totalSettled', () => {
    const rows = [
      { type: 'CORRECTION', settled: false, total: 50 },
      { type: 'CORRECTION', settled: true, total: -200 },
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 1000 },
    ]
    const f = deriveFinancials(rows)
    // unsettled correction stays in materials and corrections
    expect(f.totalMaterialCosts).toBe(1050)
    expect(f.totalCorrections).toBe(50)
    // settled correction leaves materials, lands in totalSettled (negative ok)
    expect(f.totalSettled).toBe(-200)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: FAIL — `deriveFinancials` still reads `byType.find(...type)` and ignores `settled`; the CORRECTION-settled case mis-buckets.

- [ ] **Step 3: Implement the settled-aware classifier**

In `src/lib/db/sum-transfers.ts`, add the type near the other exports and replace `deriveFinancials` + `deriveCostBreakdown` (and delete the now-unused `totalByType` helper if nothing else uses it):

```ts
export type TypeSettledTotalT = { type: string; settled: boolean; total: number }

const isExpenseType = (t: string) => t === 'INVESTMENT_EXPENSE' || t === 'CORRECTION'
const sumRows = (rows: TypeSettledTotalT[], pred: (r: TypeSettledTotalT) => boolean): number =>
  rows.reduce((acc, r) => (pred(r) ? acc + r.total : acc), 0)

/** Derive financials from a raw (type, settled) distribution. Single source of truth
 *  for the bucketing rule — both the listing and the detail page feed this. */
export function deriveFinancials(
  rows: TypeSettledTotalT[],
  categoryCosts: CategoryCostT[] = [],
  settledCategoryCosts: CategoryCostT[] = [],
): InvestmentFinancialsT {
  return {
    categoryCosts,
    totalMaterialCosts: sumRows(rows, (r) => isExpenseType(r.type) && !r.settled),
    totalCorrections: sumRows(rows, (r) => r.type === 'CORRECTION' && !r.settled),
    totalIncome: sumRows(rows, (r) => DEPOSIT_TYPES.includes(r.type as never)),
    totalLaborCosts: sumRows(rows, (r) => r.type === 'LABOR_COST'),
    totalPayouts: sumRows(rows, (r) => r.type === 'PAYOUT'),
    totalRabat: sumRows(rows, (r) => r.type === 'RABAT'),
    totalLoss: sumRows(rows, (r) => r.type === 'LOSS'),
    // Settled material is symmetric for INVESTMENT_EXPENSE and CORRECTION: it leaves
    // materials/bilans and lowers margin via this bucket.
    totalSettled: sumRows(rows, (r) => isExpenseType(r.type) && r.settled),
    settledCategoryCosts,
  }
}

/** Derive cost breakdown from a raw (type, settled) distribution. */
export function deriveCostBreakdown(rows: TypeSettledTotalT[]): CostBreakdownT {
  return {
    investmentExpenses: sumRows(rows, (r) => isExpenseType(r.type) && !r.settled),
    laborCosts: sumRows(rows, (r) => r.type === 'LABOR_COST'),
  }
}
```

> `DEPOSIT_TYPES` is already imported at the top of the file. Confirm it equals `['INVESTOR_DEPOSIT','COMPANY_FUNDING','OTHER_DEPOSIT']` in `src/lib/constants/transfers.ts`; if the constant differs, list the deposit types inline instead.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: the `deriveFinancials` / `deriveCostBreakdown` blocks PASS (other blocks may still fail until Task 1.2/1.3 — that's expected; note which).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "refactor(investments): deriveFinancials buckets settled symmetrically for CORRECTION"
```

---

### Task 1.2: `sumFilteredByType` emits raw (type, settled) sums

**Files:**

- Modify: `src/lib/db/sum-transfers.ts` (`sumFilteredByType` `:338-365`)
- Modify: `src/lib/queries/reference-data.ts` (`fetchFilteredByType` return type `:209`)
- Test: `src/__tests__/sum-transfers.test.ts` (`sumFilteredByType` + `buildSqlConditions` blocks)

**Interfaces:**

- Consumes: `TypeSettledTotalT` (Task 1.1).
- Produces: `sumFilteredByType(payload, where): Promise<TypeSettledTotalT[]>` — no longer re-buckets settled into a synthetic type string.

- [ ] **Step 1: Update the affected tests**

In `src/__tests__/sum-transfers.test.ts`:

- Delete the test `casts the enum column to text in the settled re-bucket CASE` and the comment block above it (the re-bucket CASE is gone).
- Update `returns type totals from rows` to the new shape:

```ts
it('returns type+settled totals from rows', async () => {
  mockExecute.mockResolvedValue({
    rows: [
      { type: 'INVESTMENT_EXPENSE', settled: false, total: '5000' },
      { type: 'INVESTMENT_EXPENSE', settled: true, total: '100' },
      { type: 'INVESTOR_DEPOSIT', settled: false, total: '12000' },
    ],
  })
  const result = await sumFilteredByType(fakePayload, {})
  expect(result).toEqual([
    { type: 'INVESTMENT_EXPENSE', settled: false, total: 5000 },
    { type: 'INVESTMENT_EXPENSE', settled: true, total: 100 },
    { type: 'INVESTOR_DEPOSIT', settled: false, total: 12000 },
  ])
})
```

The `buildSqlConditions — filter translation` tests still pass `mockExecute.mockResolvedValue({ rows: [] })` and assert on the WHERE clause — keep them; they don't depend on the SELECT shape. The `empty where produces no extra conditions` test splits on `cancelled IS NOT TRUE` then `GROUP BY` — keep, still valid.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: FAIL — current `sumFilteredByType` returns `{ type, total }` (no `settled`) and re-buckets settled rows.

- [ ] **Step 3: Rewrite the query**

Replace the SQL and row mapping in `sumFilteredByType`:

```ts
const result = await db.execute(
  sql.raw(`
    SELECT
      type::text AS type,
      (settled IS TRUE) AS settled,
      COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE cancelled IS NOT TRUE
      ${conditions}
    GROUP BY type, (settled IS TRUE)
    ORDER BY total DESC
  `),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
return result.rows.map((row: any) => ({
  type: row.type as string,
  settled: row.settled === true,
  total: Number(row.total),
}))
```

Change the function's return type to `Promise<TypeSettledTotalT[]>`.

- [ ] **Step 4: Update `fetchFilteredByType` return type**

In `src/lib/queries/reference-data.ts`, change the import and signature:

```ts
import { /* ... */ type TypeSettledTotalT } from '@/lib/db/sum-transfers'
// ...
export async function fetchFilteredByType(where: Where): Promise<TypeSettledTotalT[]> {
```

Remove the now-unused `TypeTotalT` import if nothing else in the file uses it (typecheck will tell you).

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: `sumFilteredByType` + `buildSqlConditions` blocks PASS.
Run: `pnpm exec tsc --noEmit` (or the repo's typecheck script) and fix any consumer of `sumFilteredByType`/`fetchFilteredByType` that assumed the old shape. The detail page (`src/app/(frontend)/inwestycje/[id]/page.tsx:55`) passes the result straight to `deriveFinancials` — no change needed there. Grep for other consumers: `grep -rn "sumFilteredByType\|fetchFilteredByType\|deriveCostBreakdown" src`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/lib/queries/reference-data.ts src/__tests__/sum-transfers.test.ts
git commit -m "refactor(investments): sumFilteredByType returns raw (type, settled) sums"
```

---

### Task 1.3: `sumAllInvestmentFinancials` feeds `deriveFinancials`

**Files:**

- Modify: `src/lib/db/sum-transfers.ts` (`sumAllInvestmentFinancials` `:152-216`)
- Test: `src/__tests__/sum-transfers.test.ts` (`sumAllInvestmentFinancials` block)

**Interfaces:**

- Consumes: `deriveFinancials` (Task 1.1).
- Produces: same `Map<number, InvestmentFinancialsT>` as before — call sites unchanged.

- [ ] **Step 1: Update the test fixtures to the new main-query shape**

Replace the `sumAllInvestmentFinancials` `describe` block. The first mocked query now returns one row per `(investment_id, type, settled)`; the second (category) query is unchanged:

```ts
describe('sumAllInvestmentFinancials', () => {
  it('returns a Map of investment financials via deriveFinancials', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          { investment_id: '1', type: 'INVESTMENT_EXPENSE', settled: false, total: '3000' },
          { investment_id: '1', type: 'INVESTOR_DEPOSIT', settled: false, total: '10000' },
          { investment_id: '1', type: 'LABOR_COST', settled: false, total: '200' },
          { investment_id: '1', type: 'PAYOUT', settled: false, total: '150' },
          { investment_id: '1', type: 'RABAT', settled: false, total: '50' },
          { investment_id: '1', type: 'LOSS', settled: false, total: '120' },
          { investment_id: '2', type: 'INVESTMENT_EXPENSE', settled: false, total: '500' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
    const map = await sumAllInvestmentFinancials(fakePayload)
    expect(map.size).toBe(2)
    expect(map.get(1)).toEqual({
      categoryCosts: [],
      totalMaterialCosts: 3000,
      totalCorrections: 0,
      totalIncome: 10000,
      totalLaborCosts: 200,
      totalPayouts: 150,
      totalRabat: 50,
      totalLoss: 120,
      totalSettled: 0,
      settledCategoryCosts: [],
    })
    expect(map.get(2)?.totalMaterialCosts).toBe(500)
  })

  it('buckets a settled CORRECTION into totalSettled, not materials', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          { investment_id: '1', type: 'CORRECTION', settled: true, total: '-200' },
          { investment_id: '1', type: 'INVESTMENT_EXPENSE', settled: false, total: '1000' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
    const inv = (await sumAllInvestmentFinancials(fakePayload)).get(1)!
    expect(inv.totalMaterialCosts).toBe(1000)
    expect(inv.totalSettled).toBe(-200)
  })

  it('includes per-category costs', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          { investment_id: '1', type: 'INVESTMENT_EXPENSE', settled: false, total: '7000' },
          { investment_id: '1', type: 'INVESTOR_DEPOSIT', settled: false, total: '10000' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { investment_id: '1', expense_category_id: '1', category_total: '5000' },
          { investment_id: '1', expense_category_id: '2', category_total: '2000' },
        ],
      })
    const inv = (await sumAllInvestmentFinancials(fakePayload)).get(1)!
    expect(inv.totalMaterialCosts).toBe(7000)
    expect(inv.categoryCosts).toEqual([
      { categoryId: 1, total: 5000 },
      { categoryId: 2, total: 2000 },
    ])
  })

  it('returns empty Map for no rows', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    const map = await sumAllInvestmentFinancials(fakePayload)
    expect(map.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: FAIL — current code reads `row.total_costs` etc. from the old aggregated row.

- [ ] **Step 3: Rewrite the main query + builder**

Replace the body of `sumAllInvestmentFinancials` (keep the category query as the second element of `Promise.all`):

```ts
const [totalsResult, categoryResult] = await Promise.all([
  db.execute(sql`
      SELECT investment_id,
        type::text AS type,
        (settled IS TRUE) AS settled,
        COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
      GROUP BY investment_id, type, (settled IS TRUE)
    `),
  db.execute(sql`
      SELECT investment_id, expense_category_id,
        COALESCE(SUM(amount), 0) AS category_total
      FROM transactions
      WHERE investment_id IS NOT NULL
        AND cancelled IS NOT TRUE
        AND type IN ('INVESTMENT_EXPENSE', 'CORRECTION')
        AND expense_category_id IS NOT NULL
        AND settled IS NOT TRUE
      GROUP BY investment_id, expense_category_id
    `),
])

// Group raw (type, settled) sums per investment.
const rowsByInvestment = new Map<number, TypeSettledTotalT[]>()
for (const row of totalsResult.rows) {
  const invId = Number(row.investment_id)
  if (!rowsByInvestment.has(invId)) rowsByInvestment.set(invId, [])
  rowsByInvestment.get(invId)!.push({
    type: row.type as string,
    settled: row.settled === true,
    total: Number(row.total),
  })
}

const categoryMap = new Map<number, CategoryCostT[]>()
for (const row of categoryResult.rows) {
  const invId = Number(row.investment_id)
  if (!categoryMap.has(invId)) categoryMap.set(invId, [])
  categoryMap.get(invId)!.push({
    categoryId: Number(row.expense_category_id),
    total: Number(row.category_total),
  })
}

const map = new Map<number, InvestmentFinancialsT>()
for (const invId of rowsByInvestment.keys()) {
  // List view shows the per-category aggregate only, not the settled split → [].
  map.set(invId, deriveFinancials(rowsByInvestment.get(invId)!, categoryMap.get(invId) ?? [], []))
}
```

> An investment with category rows but no totals rows is impossible (a categorised row is also a typed row), so iterating `rowsByInvestment.keys()` covers every investment. Keep the existing `console.log(... map.size ...)` line.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
Expected: ALL blocks PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "refactor(investments): listing path feeds the shared deriveFinancials classifier"
```

---

### Task 1.4: Parity guard test

**Files:**

- Create: `src/__tests__/investment-financials-parity.test.ts`

**Interfaces:**

- Consumes: `sumAllInvestmentFinancials`, `sumFilteredByType`, `sumCategoryBreakdown`, `sumSettledCategoryBreakdown`, `deriveFinancials`, `extractFigures`, the mocked-`db.execute` pattern from `sum-transfers.test.ts`.

> This test mocks `db.execute` so the two paths receive the SAME synthetic transactions and must yield the SAME six figures. It guards against the listing/detail bucketing rules drifting apart again.

- [ ] **Step 1: Write the parity test**

```ts
// src/__tests__/investment-financials-parity.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryBreakdown,
  sumSettledCategoryBreakdown,
  deriveFinancials,
} from '@/lib/db/sum-transfers'
import { extractFigures } from '@/lib/investment-figures'

const mockExecute = vi.fn()
const fakePayload = {
  db: { drizzle: { execute: mockExecute }, sessions: {} },
} as unknown as Payload

beforeEach(() => mockExecute.mockReset())

// One synthetic investment's transactions, expressed as the rows each query would
// return from Postgres for that data. listing = grouped-by-(type,settled); detail =
// same minus the investment_id column. Category rows shared.
const TYPE_ROWS = [
  { type: 'INVESTMENT_EXPENSE', settled: false, total: '3000' },
  { type: 'CORRECTION', settled: true, total: '-200' }, // the divergence case
  { type: 'INVESTOR_DEPOSIT', settled: false, total: '10000' },
  { type: 'LABOR_COST', settled: false, total: '800' },
  { type: 'PAYOUT', settled: false, total: '300' },
]
const CATEGORY_ROWS = [{ expense_category_id: '1', category_total: '3000' }]

describe('listing vs detail figure parity', () => {
  it('produces identical figures for the same transactions (incl. settled CORRECTION)', async () => {
    // Listing path: main query rows carry investment_id; category query rows too.
    mockExecute
      .mockResolvedValueOnce({ rows: TYPE_ROWS.map((r) => ({ investment_id: '1', ...r })) })
      .mockResolvedValueOnce({
        rows: CATEGORY_ROWS.map((r) => ({ investment_id: '1', ...r })),
      })
    const listingFin = (await sumAllInvestmentFinancials(fakePayload)).get(1)!

    // Detail path: sumFilteredByType, then sumCategoryBreakdown, then settled breakdown.
    mockExecute.mockReset()
    mockExecute
      .mockResolvedValueOnce({ rows: TYPE_ROWS }) // sumFilteredByType
      .mockResolvedValueOnce({ rows: CATEGORY_ROWS }) // sumCategoryBreakdown
      .mockResolvedValueOnce({ rows: [] }) // sumSettledCategoryBreakdown
    const where = { investment: { equals: 1 } }
    const [byType, cats, settledCats] = [
      await sumFilteredByType(fakePayload, where),
      await sumCategoryBreakdown(fakePayload, where),
      await sumSettledCategoryBreakdown(fakePayload, where),
    ]
    const detailFin = deriveFinancials(byType, cats, settledCats)

    expect(extractFigures(listingFin)).toEqual(extractFigures(detailFin))
    // And the settled correction did NOT touch bilans, but DID lower margin:
    const f = extractFigures(detailFin)
    expect(f.materialy).toBe(3000) // settled CORRECTION excluded
    expect(f.settled).toBe(-200)
  })
})
```

- [ ] **Step 2: Run to verify it passes (paths already converged in Phase 1)**

Run: `pnpm exec vitest run src/__tests__/investment-financials-parity.test.ts`
Expected: PASS. (If it fails, the two paths still disagree — fix `deriveFinancials`/the queries before continuing.)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/investment-financials-parity.test.ts
git commit -m "test(investments): parity guard — listing and detail figures must match"
```

---

## Phase 2 — Surface the feature (settled on CORRECTION)

### Task 2.1: Persist `settled` for CORRECTION in the bulk action

**Files:**

- Modify: `src/lib/actions/transfers.ts:142`

**Interfaces:** none new — behavior change only.

- [ ] **Step 1: Widen the coercion**

Replace line 142:

```ts
              settled:
                (parsed.data.type === 'INVESTMENT_EXPENSE' ||
                  parsed.data.type === 'CORRECTION') &&
                parsed.data.settled === true,
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/transfers.ts
git commit -m "feat(korekta): bulk action persists settled for CORRECTION"
```

---

### Task 2.2: Show the settled checkbox for CORRECTION

**Files:**

- Modify: `src/components/forms/expense-form/expense-form.tsx:225`

- [ ] **Step 1: Widen the render condition**

Replace the condition on the settled `AppField` block:

```tsx
{
  ;(currentType === 'INVESTMENT_EXPENSE' || currentType === 'CORRECTION') && (
    <form.AppField name="settled">
      {(field) => (
        <field.Checkbox label="Wliczone w robociznę (materiał w cenie robocizny — nie obciąża klienta)" />
      )}
    </form.AppField>
  )
}
```

`settled` is already in `conditionalFields` (`:177`), so it still resets on type switch. No other change.

- [ ] **Step 2: Manual check (dev server)**

Run the app, open the expense form, select **Korekta** → the "Wliczone w robociznę" checkbox appears; switch to a non-expense type → it disappears and resets. (Local login caveats: see memory `project_local_login_and_test_fixtures`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/forms/expense-form/expense-form.tsx
git commit -m "feat(korekta): show 'wliczone w robociznę' checkbox for CORRECTION"
```

---

### Task 2.3: Widen the collection field condition

**Files:**

- Modify: `src/collections/transfers.ts:237`

- [ ] **Step 1: Update `admin.condition`**

```ts
        condition: (data) => data?.type === 'INVESTMENT_EXPENSE' || data?.type === 'CORRECTION',
```

- [ ] **Step 2: Regenerate types + typecheck**

Run: `pnpm generate:types` then `pnpm exec tsc --noEmit`. Do NOT `git add` `src/payload-types.ts` (gitignored).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/collections/transfers.ts
git commit -m "feat(korekta): admin panel shows settled field for CORRECTION"
```

---

### Task 2.4: Guard `settled` to the two allowed types

**Files:**

- Modify: `src/hooks/transfers/validate.ts`

**Interfaces:** none — defense-in-depth so the admin panel/API cannot persist `settled` on an unrelated type.

- [ ] **Step 1: Add the guard**

After the worker auto-clear block (`:86-89`) and before the expenseCategory check, add:

```ts
// settled (wliczone w robociznę) only applies to material expenses and their
// corrections — clear it everywhere else so the admin panel / API can't persist
// a stray flag that the reporting layer would mis-bucket.
if (type !== 'INVESTMENT_EXPENSE' && type !== 'CORRECTION') {
  d.settled = false
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. (`settled` is a field on `Transaction`; assigning `false` is valid.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/transfers/validate.ts
git commit -m "fix(transfers): clear settled flag for types other than EXPENSE/CORRECTION"
```

---

## Phase 3 — Prove no regression

### Task 3.1: Re-run snapshot, diff before/after

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm exec vitest run`
Expected: PASS (all of `sum-transfers`, `investment-figures`, `investment-financials-parity`, plus untouched suites).

- [ ] **Step 2: Produce the "after" snapshot**

Run: `pnpm tsx scripts/audit-investment-parity.ts after`
Expected: writes `dumps/parity-after.json` / `.csv`; outlier count should be **0** (both paths converged).

- [ ] **Step 3: Diff before vs after**

Run: `diff <(jq -S . dumps/parity-before.json) <(jq -S . dumps/parity-after.json)`
Expected: empty, EXCEPT for any investment Task 0.2/Step 4 flagged as a pre-existing outlier — those legitimately move to the corrected values. Report the diff to the user; do not assume.

- [ ] **Step 4: Commit the after-baseline + a short note**

```bash
git add dumps/parity-after.json dumps/parity-after.csv
git commit -m "chore(investments): after baseline confirms listing/detail parity"
```

(Skip if `dumps/` is gitignored; report the diff in the PR instead.)

---

## Self-Review

**Spec coverage:**

- Settled symmetric for EXPENSE/CORRECTION → Task 1.1. ✓
- Single source of truth (2c) → Tasks 1.1–1.3. ✓
- Form/action/collection/guard → Tasks 2.1–2.4. ✓
- Baseline JSON+CSV + outliers → Task 0.2. ✓
- Unit parity test → Task 1.4. ✓
- Before/after diff → Task 3.1. ✓
- Detail page consuming new shape → covered by Task 1.2/Step 5 (no code change needed; verified by typecheck + parity test). ✓

**Placeholder scan:** none — every code step has full code.

**Type consistency:** `TypeSettledTotalT` defined in Task 1.1, consumed by 1.2/1.3 and the detail page; `InvestmentFiguresT`/`extractFigures` defined in 0.1, used in 0.2 and 1.4. `deriveFinancials` signature consistent across tasks.

**Open verification items folded into steps (not placeholders):**

- `DEPOSIT_TYPES` exact membership — Task 1.1/Step 3 note.
- Other consumers of `sumFilteredByType`/`deriveCostBreakdown` — Task 1.2/Step 5 grep.
- `dumps/` gitignore status — handled in commit steps.
