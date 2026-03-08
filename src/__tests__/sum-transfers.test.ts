import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import {
  sumRegisterBalance,
  sumAllRegisterBalances,
  sumAllInvestmentFinancials,
  sumAllWorkerSaldos,
  sumFilteredByType,
  deriveWorkerBreakdown,
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

// ── sumAllInvestmentFinancials ────────────────────────────────────────────

describe('sumAllInvestmentFinancials', () => {
  it('returns a Map of investment financials', async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          investment_id: '1',
          total_costs: '3000',
          total_income: '10000',
          total_labor_costs: '200',
        },
        { investment_id: '2', total_costs: '500', total_income: '0', total_labor_costs: '0' },
      ],
    })
    const map = await sumAllInvestmentFinancials(fakePayload)
    expect(map.size).toBe(2)
    expect(map.get(1)).toEqual({ totalCosts: 3000, totalIncome: 10000, totalLaborCosts: 200 })
    expect(map.get(2)).toEqual({ totalCosts: 500, totalIncome: 0, totalLaborCosts: 0 })
  })

  it('returns empty Map for no rows', async () => {
    mockExecute.mockResolvedValue({ rows: [] })
    const map = await sumAllInvestmentFinancials(fakePayload)
    expect(map.size).toBe(0)
  })
})

// ── sumAllWorkerSaldos ───────────────────────────────────────────────────

describe('sumAllWorkerSaldos', () => {
  it('returns a Map of worker saldos', async () => {
    mockExecute.mockResolvedValue({
      rows: [
        { worker_id: '10', saldo: '500' },
        { worker_id: '20', saldo: '-200' },
      ],
    })
    const map = await sumAllWorkerSaldos(fakePayload)
    expect(map.size).toBe(2)
    expect(map.get(10)).toBe(500)
    expect(map.get(20)).toBe(-200)
  })

  it('returns empty Map for no workers', async () => {
    mockExecute.mockResolvedValue({ rows: [] })
    const map = await sumAllWorkerSaldos(fakePayload)
    expect(map.size).toBe(0)
  })
})

// ── deriveWorkerBreakdown ────────────────────────────────────────────

describe('deriveWorkerBreakdown', () => {
  it('derives advances, expenses, and periodSaldo', () => {
    const byType = [
      { type: 'ACCOUNT_FUNDING', total: 1000 },
      { type: 'EMPLOYEE_EXPENSE', total: 600 },
    ]
    expect(deriveWorkerBreakdown(byType)).toEqual({
      totalAdvances: 1000,
      totalExpenses: 600,
      periodSaldo: 400,
    })
  })

  it('only advances → expenses = 0', () => {
    expect(deriveWorkerBreakdown([{ type: 'ACCOUNT_FUNDING', total: 500 }])).toEqual({
      totalAdvances: 500,
      totalExpenses: 0,
      periodSaldo: 500,
    })
  })

  it('only expenses → negative periodSaldo', () => {
    expect(deriveWorkerBreakdown([{ type: 'EMPLOYEE_EXPENSE', total: 800 }])).toEqual({
      totalAdvances: 0,
      totalExpenses: 800,
      periodSaldo: -800,
    })
  })

  it('empty array → all zeros', () => {
    expect(deriveWorkerBreakdown([])).toEqual({
      totalAdvances: 0,
      totalExpenses: 0,
      periodSaldo: 0,
    })
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

  it('passes worker filter to SQL', async () => {
    await sumFilteredByType(fakePayload, { worker: { in: [10, 20] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('worker_id IN (10, 20)')
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
    expect(queryStr).not.toContain('AND')
  })
})

// ── deriveFinancials / deriveCostBreakdown ────────────────────────

describe('deriveFinancials', () => {
  it('derives totals from type distribution', () => {
    const byType = [
      { type: 'INVESTMENT_EXPENSE', total: 5000 },
      { type: 'EMPLOYEE_EXPENSE', total: 2000 },
      { type: 'INVESTOR_DEPOSIT', total: 12000 },
      { type: 'LABOR_COST', total: 800 },
    ]
    expect(deriveFinancials(byType)).toEqual({
      totalCosts: 7000,
      totalIncome: 12000,
      totalLaborCosts: 800,
    })
  })

  it('returns zeros for empty array', () => {
    expect(deriveFinancials([])).toEqual({ totalCosts: 0, totalIncome: 0, totalLaborCosts: 0 })
  })
})

describe('deriveCostBreakdown', () => {
  it('derives breakdown from type distribution', () => {
    const byType = [
      { type: 'INVESTMENT_EXPENSE', total: 5000 },
      { type: 'EMPLOYEE_EXPENSE', total: 2000 },
      { type: 'LABOR_COST', total: 800 },
    ]
    expect(deriveCostBreakdown(byType)).toEqual({
      investmentExpenses: 5000,
      employeeExpenses: 2000,
      laborCosts: 800,
    })
  })

  it('returns zeros for empty array', () => {
    expect(deriveCostBreakdown([])).toEqual({
      investmentExpenses: 0,
      employeeExpenses: 0,
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

  it('returns type totals from rows', async () => {
    mockExecute.mockResolvedValue({
      rows: [
        { type: 'INVESTMENT_EXPENSE', total: '5000' },
        { type: 'INVESTOR_DEPOSIT', total: '12000' },
      ],
    })
    const result = await sumFilteredByType(fakePayload, {})
    expect(result).toEqual([
      { type: 'INVESTMENT_EXPENSE', total: 5000 },
      { type: 'INVESTOR_DEPOSIT', total: 12000 },
    ])
  })

  it('passes filters to SQL', async () => {
    mockExecute.mockResolvedValue({ rows: [] })
    await sumFilteredByType(fakePayload, { date: { greater_than_equal: '2024-01-01' } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("date >= '2024-01-01'")
  })
})
