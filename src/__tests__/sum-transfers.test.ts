import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import {
  sumRegisterBalance,
  sumAllRegisterBalances,
  sumAllWorkerBalances,
  sumAllInvestmentFinancials,
  sumFilteredByType,
  deriveFinancials,
  deriveCostBreakdown,
} from '@/lib/db/sum-transfers'

// ── Fake Payload with controllable db.drizzle.execute ────────────────────

const mockExecute = vi.fn()

/**
 * getDb resolves to payload.db.drizzle (when no req/transactionID).
 * We provide a minimal shape that satisfies the internal access pattern.
 */
const fakePayload = {
  db: { drizzle: { execute: mockExecute }, sessions: {} },
} as unknown as Payload

beforeEach(() => {
  mockExecute.mockReset()
})

// ── sumRegisterBalance ───────────────────────────────────────────────────

describe('sumRegisterBalance', () => {
  it('returns the balance from rows', async () => {
    mockExecute.mockResolvedValue({ rows: [{ balance: '1500.00' }] })
    const result = await sumRegisterBalance(fakePayload, 1)
    expect(result).toBe(1500)
  })

  it('returns 0 for empty result (COALESCE)', async () => {
    mockExecute.mockResolvedValue({ rows: [{ balance: '0' }] })
    const result = await sumRegisterBalance(fakePayload, 1)
    expect(result).toBe(0)
  })

  it('handles negative balance', async () => {
    mockExecute.mockResolvedValue({ rows: [{ balance: '-300.50' }] })
    const result = await sumRegisterBalance(fakePayload, 1)
    expect(result).toBe(-300.5)
  })
})

// ── sumAllRegisterBalances ───────────────────────────────────────────────

describe('sumAllRegisterBalances', () => {
  it('returns a Map of register balances', async () => {
    mockExecute.mockResolvedValue({
      rows: [
        { register_id: '1', balance: '1000' },
        { register_id: '2', balance: '-500' },
        { register_id: '3', balance: '2500.75' },
      ],
    })
    const map = await sumAllRegisterBalances(fakePayload)
    expect(map.size).toBe(3)
    expect(map.get(1)).toBe(1000)
    expect(map.get(2)).toBe(-500)
    expect(map.get(3)).toBe(2500.75)
  })

  it('returns empty Map for no rows', async () => {
    mockExecute.mockResolvedValue({ rows: [] })
    const map = await sumAllRegisterBalances(fakePayload)
    expect(map.size).toBe(0)
  })

  it('handles register with only incoming transfers', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ register_id: '5', balance: '800' }],
    })
    const map = await sumAllRegisterBalances(fakePayload)
    expect(map.get(5)).toBe(800)
  })
})

// ── sumAllWorkerBalances ─────────────────────────────────────────────────

describe('sumAllWorkerBalances', () => {
  it('returns a Map of worker payout totals', async () => {
    mockExecute.mockResolvedValue({
      rows: [
        { worker_id: '1', balance: '3000' },
        { worker_id: '2', balance: '1500.50' },
      ],
    })
    const map = await sumAllWorkerBalances(fakePayload)
    expect(map.size).toBe(2)
    expect(map.get(1)).toBe(3000)
    expect(map.get(2)).toBe(1500.5)
  })

  it('returns empty Map when no workers have payouts', async () => {
    mockExecute.mockResolvedValue({ rows: [] })
    const map = await sumAllWorkerBalances(fakePayload)
    expect(map.size).toBe(0)
  })

  it('handles single worker', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ worker_id: '7', balance: '500' }],
    })
    const map = await sumAllWorkerBalances(fakePayload)
    expect(map.size).toBe(1)
    expect(map.get(7)).toBe(500)
  })
})

// ── sumAllInvestmentFinancials ────────────────────────────────────────────

describe('sumAllInvestmentFinancials', () => {
  it('returns a Map of investment financials', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            investment_id: '1',
            total_costs: '3000',
            total_corrections: '0',
            total_income: '10000',
            total_labor_costs: '200',
            total_payouts: '150',
            total_rabat: '50',
            total_loss: '120',
            total_settled: '0',
          },
          {
            investment_id: '2',
            total_costs: '500',
            total_corrections: '0',
            total_income: '0',
            total_labor_costs: '0',
            total_payouts: '0',
            total_rabat: '0',
            total_loss: '0',
            total_settled: '0',
          },
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
    expect(map.get(2)).toEqual({
      categoryCosts: [],
      totalMaterialCosts: 500,
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

  it('returns empty Map for no rows', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    const map = await sumAllInvestmentFinancials(fakePayload)
    expect(map.size).toBe(0)
  })

  it('includes per-category costs', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            investment_id: '1',
            total_costs: '7000',
            total_corrections: '0',
            total_income: '10000',
            total_labor_costs: '800',
            total_payouts: '0',
          },
        ],
      })
      .mockResolvedValueOnce({
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

// ── buildSqlConditions — filter translation (via sumFilteredByType) ──

/** Extract raw SQL string from sql.raw() query object passed to db.execute */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSql(query: any): string {
  return query.queryChunks?.[0]?.value?.[0] ?? String(query)
}

describe('buildSqlConditions — filter translation', () => {
  beforeEach(() => {
    mockExecute.mockResolvedValue({ rows: [] })
  })

  it('passes type filter to SQL', async () => {
    await sumFilteredByType(fakePayload, { type: { in: ['PAYOUT', 'OTHER'] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("type IN ('PAYOUT', 'OTHER')")
  })

  it('passes date range to SQL', async () => {
    await sumFilteredByType(fakePayload, {
      date: { greater_than_equal: '2024-01-01', less_than_equal: '2024-12-31' },
    })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("date >= '2024-01-01'")
    expect(queryStr).toContain("date <= '2024-12-31'")
  })

  it('passes investment filter to SQL', async () => {
    await sumFilteredByType(fakePayload, { investment: { in: [5] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('investment_id IN (5)')
  })

  it('passes OR register filter to SQL', async () => {
    await sumFilteredByType(fakePayload, {
      or: [{ sourceRegister: { in: [3] } }, { targetRegister: { in: [3] } }],
    })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('source_register_id IN (3)')
    expect(queryStr).toContain('target_register_id IN (3)')
    expect(queryStr).toContain(' OR ')
  })

  it('passes worker filter to SQL', async () => {
    await sumFilteredByType(fakePayload, { worker: { equals: 5 } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('worker_id = 5')
  })

  it('passes worker filter combined with date range to SQL', async () => {
    await sumFilteredByType(fakePayload, {
      worker: { equals: 3 },
      date: { greater_than_equal: '2024-06-01', less_than_equal: '2024-12-31' },
    })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('worker_id = 3')
    expect(queryStr).toContain("date >= '2024-06-01'")
    expect(queryStr).toContain("date <= '2024-12-31'")
  })

  it('passes payment method filter to SQL', async () => {
    await sumFilteredByType(fakePayload, { paymentMethod: { in: ['CASH'] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("payment_method IN ('CASH')")
  })

  it('returns empty array and skips SQL when NO_RESULTS sentinel present', async () => {
    const result = await sumFilteredByType(fakePayload, { id: { equals: -1 } })
    expect(result).toEqual([])
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('empty where produces no extra conditions', async () => {
    await sumFilteredByType(fakePayload, {})
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('WHERE cancelled IS NOT TRUE')
    // No filter clauses appended in the conditions slot (between WHERE and GROUP BY).
    // The base SELECT now contains an unrelated `AND` inside the settled re-bucket CASE.
    const conditionsSlot = queryStr.split('cancelled IS NOT TRUE')[1].split('GROUP BY')[0]
    expect(conditionsSlot.trim()).toBe('')
  })
})

// ── deriveFinancials / deriveCostBreakdown ────────────────────────

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

  it('includes category costs when provided', () => {
    const rows = [
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 5000 },
      { type: 'INVESTOR_DEPOSIT', settled: false, total: 12000 },
      { type: 'LABOR_COST', settled: false, total: 800 },
    ]
    const byCat = [
      { categoryId: 1, total: 3000 },
      { categoryId: 2, total: 2000 },
    ]
    const result = deriveFinancials(rows, byCat)
    expect(result.totalMaterialCosts).toBe(5000)
    expect(result.totalPayouts).toBe(0)
    expect(result.categoryCosts).toEqual(byCat)
  })
})

describe('deriveFinancials — settled material is symmetric for EXPENSE and CORRECTION', () => {
  it('keeps settled INVESTMENT_EXPENSE out of materials, into totalSettled', () => {
    const rows = [
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 200 },
      { type: 'INVESTMENT_EXPENSE', settled: true, total: 100 },
      { type: 'LABOR_COST', settled: false, total: 500 },
      { type: 'INVESTOR_DEPOSIT', settled: false, total: 1000 },
    ]
    const f = deriveFinancials(rows)
    expect(f.totalMaterialCosts).toBe(200) // settled NOT folded in
    expect(f.totalSettled).toBe(100)
    expect(f.settledCategoryCosts).toEqual([])
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

  it('passes through settledCategoryCosts when provided', () => {
    const f = deriveFinancials([], [], [{ categoryId: 7, total: 100 }])
    expect(f.settledCategoryCosts).toEqual([{ categoryId: 7, total: 100 }])
  })
})

describe('deriveCostBreakdown', () => {
  it('derives breakdown from type+settled distribution', () => {
    const rows = [
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 5000 },
      { type: 'LABOR_COST', settled: false, total: 800 },
    ]
    expect(deriveCostBreakdown(rows)).toEqual({
      investmentExpenses: 5000,
      laborCosts: 800,
    })
  })

  it('returns zeros for empty array', () => {
    expect(deriveCostBreakdown([])).toEqual({
      investmentExpenses: 0,
      laborCosts: 0,
    })
  })
})

// ── sumFilteredByType ────────────────────────────────────────────

describe('sumFilteredByType', () => {
  it('returns empty array on NO_RESULTS sentinel', async () => {
    const result = await sumFilteredByType(fakePayload, { id: { equals: -1 } })
    expect(result).toEqual([])
    expect(mockExecute).not.toHaveBeenCalled()
  })

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

  it('passes filters to SQL', async () => {
    mockExecute.mockResolvedValue({ rows: [] })
    await sumFilteredByType(fakePayload, { date: { greater_than_equal: '2024-01-01' } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("date >= '2024-01-01'")
  })
})
