import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import {
  sumRegisterBalance,
  sumInvestmentCosts,
  sumInvestmentIncome,
  sumAllRegisterBalances,
  sumAllInvestmentFinancials,
  sumAllWorkerSaldos,
  sumEmployeeSaldo,
  sumWorkerPeriodBreakdown,
  sumFilteredFinancials,
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

// ── sumInvestmentCosts ───────────────────────────────────────────────────

describe('sumInvestmentCosts', () => {
  it('returns the total from rows', async () => {
    mockExecute.mockResolvedValue({ rows: [{ total: '5000' }] })
    const result = await sumInvestmentCosts(fakePayload, 10)
    expect(result).toBe(5000)
  })

  it('returns 0 when no matching transactions', async () => {
    mockExecute.mockResolvedValue({ rows: [{ total: '0' }] })
    const result = await sumInvestmentCosts(fakePayload, 10)
    expect(result).toBe(0)
  })
})

// ── sumInvestmentIncome ──────────────────────────────────────────────────

describe('sumInvestmentIncome', () => {
  it('returns the total from rows', async () => {
    mockExecute.mockResolvedValue({ rows: [{ total: '12000' }] })
    const result = await sumInvestmentIncome(fakePayload, 10)
    expect(result).toBe(12000)
  })

  it('returns 0 when empty', async () => {
    mockExecute.mockResolvedValue({ rows: [{ total: '0' }] })
    const result = await sumInvestmentIncome(fakePayload, 10)
    expect(result).toBe(0)
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

// ── sumEmployeeSaldo ─────────────────────────────────────────────────────

describe('sumEmployeeSaldo', () => {
  it('returns all-time saldo', async () => {
    mockExecute.mockResolvedValue({ rows: [{ saldo: '750' }] })
    const result = await sumEmployeeSaldo(fakePayload, 10)
    expect(result).toBe(750)
  })

  it('returns saldo within date range', async () => {
    mockExecute.mockResolvedValue({ rows: [{ saldo: '300' }] })
    const result = await sumEmployeeSaldo(fakePayload, 10, {
      start: '2024-01-01',
      end: '2024-01-31',
    })
    expect(result).toBe(300)
  })

  it('returns 0 when no transactions', async () => {
    mockExecute.mockResolvedValue({ rows: [{ saldo: '0' }] })
    const result = await sumEmployeeSaldo(fakePayload, 10)
    expect(result).toBe(0)
  })

  it('handles negative saldo', async () => {
    mockExecute.mockResolvedValue({ rows: [{ saldo: '-150' }] })
    const result = await sumEmployeeSaldo(fakePayload, 10)
    expect(result).toBe(-150)
  })
})

// ── sumWorkerPeriodBreakdown ─────────────────────────────────────────────

describe('sumWorkerPeriodBreakdown', () => {
  const dateRange = { start: '2024-01-01', end: '2024-01-31' }

  it('returns advances, expenses, and periodSaldo', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ advances: '1000', expenses: '600' }],
    })
    const result = await sumWorkerPeriodBreakdown(fakePayload, 10, dateRange)
    expect(result).toEqual({
      totalAdvances: 1000,
      totalExpenses: 600,
      periodSaldo: 400,
    })
  })

  it('only advances → expenses = 0', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ advances: '500', expenses: '0' }],
    })
    const result = await sumWorkerPeriodBreakdown(fakePayload, 10, dateRange)
    expect(result).toEqual({
      totalAdvances: 500,
      totalExpenses: 0,
      periodSaldo: 500,
    })
  })

  it('only expenses → advances = 0, negative periodSaldo', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ advances: '0', expenses: '800' }],
    })
    const result = await sumWorkerPeriodBreakdown(fakePayload, 10, dateRange)
    expect(result).toEqual({
      totalAdvances: 0,
      totalExpenses: 800,
      periodSaldo: -800,
    })
  })

  it('empty range → all zeros', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ advances: '0', expenses: '0' }],
    })
    const result = await sumWorkerPeriodBreakdown(fakePayload, 10, dateRange)
    expect(result).toEqual({
      totalAdvances: 0,
      totalExpenses: 0,
      periodSaldo: 0,
    })
  })
})

// ── sumFilteredFinancials ────────────────────────────────────────────

describe('sumFilteredFinancials', () => {
  it('returns totals from rows', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '5000', total_income: '12000', total_labor_costs: '800' }],
    })
    const result = await sumFilteredFinancials(fakePayload, {})
    expect(result).toEqual({ totalCosts: 5000, totalIncome: 12000, totalLaborCosts: 800 })
  })

  it('returns zeros when no matching transactions', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '0', total_income: '0', total_labor_costs: '0' }],
    })
    const result = await sumFilteredFinancials(fakePayload, {})
    expect(result).toEqual({ totalCosts: 0, totalIncome: 0, totalLaborCosts: 0 })
  })
})

// ── sumFilteredFinancials — filter translation ───────────────────────

/** Extract raw SQL string from sql.raw() query object passed to db.execute */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSql(query: any): string {
  return query.queryChunks?.[0]?.value?.[0] ?? String(query)
}

describe('sumFilteredFinancials — filter translation', () => {
  beforeEach(() => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '0', total_income: '0', total_labor_costs: '0' }],
    })
  })

  it('passes type filter to SQL', async () => {
    await sumFilteredFinancials(fakePayload, { type: { in: ['PAYOUT', 'OTHER'] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("type IN ('PAYOUT', 'OTHER')")
  })

  it('passes date range to SQL', async () => {
    await sumFilteredFinancials(fakePayload, {
      date: { greater_than_equal: '2024-01-01', less_than_equal: '2024-12-31' },
    })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("date >= '2024-01-01'")
    expect(queryStr).toContain("date <= '2024-12-31'")
  })

  it('passes investment filter to SQL', async () => {
    await sumFilteredFinancials(fakePayload, { investment: { in: [5] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('investment_id IN (5)')
  })

  it('passes worker filter to SQL', async () => {
    await sumFilteredFinancials(fakePayload, { worker: { in: [10, 20] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('worker_id IN (10, 20)')
  })

  it('passes payment method filter to SQL', async () => {
    await sumFilteredFinancials(fakePayload, { paymentMethod: { in: ['CASH'] } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain("payment_method IN ('CASH')")
  })

  it('skips id sentinel field', async () => {
    await sumFilteredFinancials(fakePayload, { id: { equals: -1 } })
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).not.toContain('id =')
  })

  it('empty where produces no extra conditions', async () => {
    await sumFilteredFinancials(fakePayload, {})
    const queryStr = extractSql(mockExecute.mock.calls[0][0])
    expect(queryStr).toContain('WHERE cancelled IS NOT TRUE')
    expect(queryStr).not.toContain('AND')
  })
})
