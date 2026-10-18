import { describe, it, expect, beforeEach } from 'vitest'
import {
  sumRegisterBalance,
  sumAllRegisterBalances,
  sumAllInvestmentFinancials,
  sumFilteredByType,
  listTransferFacets,
} from '@/lib/db/sum-transfers'
import { deriveFinancials } from '@/lib/db/investment-financials'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import { fakePayload, mockExecute, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'

beforeEach(resetFakePayload)

describe('sumRegisterBalance', () => {
  it('handles negative balance', async () => {
    mockExecute.mockResolvedValue({ rows: [{ balance: '-300.50' }] })
    const result = await sumRegisterBalance(fakePayload, 1)
    expect(result).toBe(-300.5)
  })
})

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
})

describe('sumAllInvestmentFinancials', () => {
  it('returns a Map of investment financials via deriveFinancials', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            investment_id: '1',
            is_total: 1,
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '3000',
          },
          {
            investment_id: '1',
            is_total: 1,
            type: 'INVESTOR_DEPOSIT',
            settled: false,
            total: '10000',
          },
          { investment_id: '1', is_total: 1, type: 'LABOR_COST', settled: false, total: '200' },
          { investment_id: '1', is_total: 1, type: 'PAYOUT', settled: false, total: '150' },
          { investment_id: '1', is_total: 1, type: 'RABAT', settled: false, total: '50' },
          { investment_id: '1', is_total: 1, type: 'LOSS', settled: false, total: '120' },
          { investment_id: '1', is_total: 1, type: 'BONUS', settled: false, total: '70' },
          {
            investment_id: '2',
            is_total: 1,
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '500',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: '1', materials_net_rate: null, settlement_mode: 'NET' }],
      })
    const map = await sumAllInvestmentFinancials(fakePayload)
    expect(map.size).toBe(2)
    expect(map.get(1)).toEqual({
      categoryCosts: [],
      totalMaterialCosts: 3000,
      materialsGrossBase: 3000,
      materialsNetBilled: 0,
      totalIncome: 10000,
      totalLaborCosts: 200,
      totalPayouts: 150,
      totalDiscount: 50,
      totalLoss: 120,
      totalBonus: 70,
      totalSettled: 0,
      materialsNetDiscount: 0,
      settledCategoryCosts: [],
      netCategoryCosts: [],
    })
    expect(map.get(2)?.totalMaterialCosts).toBe(500)
  })

  it('buckets a settled CORRECTION into totalSettled, not materials', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          { investment_id: '1', is_total: 1, type: 'CORRECTION', settled: true, total: '-200' },
          {
            investment_id: '1',
            is_total: 1,
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '1000',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: '1', materials_net_rate: null, settlement_mode: 'NET' }],
      })
    const inv = (await sumAllInvestmentFinancials(fakePayload)).get(1)!
    expect(inv.totalMaterialCosts).toBe(1000)
    expect(inv.totalSettled).toBe(-200)
  })

  it('includes per-category costs', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            investment_id: '1',
            is_total: 1,
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '7000',
          },
          {
            investment_id: '1',
            is_total: 1,
            type: 'INVESTOR_DEPOSIT',
            settled: false,
            total: '10000',
          },
          {
            investment_id: '1',
            is_total: 0,
            expense_category_id: '1',
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '5000',
          },
          {
            investment_id: '1',
            is_total: 0,
            expense_category_id: '2',
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '2000',
          },
          // The category grouping set also yields the uncategorised remainder; it is already in
          // the per-type total and must not become a category of its own.
          {
            investment_id: '1',
            is_total: 0,
            expense_category_id: null,
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '999',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: '1', materials_net_rate: null, settlement_mode: 'NET' }],
      })
    const map = await sumAllInvestmentFinancials(fakePayload)
    const inv = map.get(1)!
    expect(inv.totalMaterialCosts).toBe(7000)
    expect(inv.totalIncome).toBe(10000)
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

  it('applies the per-investment materiały netto rate it looked up', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            investment_id: '1',
            is_total: 1,
            type: 'INVESTMENT_EXPENSE',
            settled: false,
            total: '123',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: '1', materials_net_rate: 0.23, settlement_mode: 'NET' }],
      })
    const inv = (await sumAllInvestmentFinancials(fakePayload)).get(1)!
    expect(inv.materialsNetDiscount).toBeCloseTo(23, 10)
  })
})

describe('sumFilteredByType — Where handling', () => {
  it('returns empty array and skips SQL when NO_RESULTS sentinel present', async () => {
    const result = await sumFilteredByType(fakePayload, { id: { equals: -1 } })
    expect(result).toEqual([])
    expect(mockExecute).not.toHaveBeenCalled()
  })
})

describe('listTransferFacets', () => {
  it('skips SQL and offers nothing on the NO_RESULTS sentinel', async () => {
    const result = await listTransferFacets(fakePayload, { id: { equals: -1 } })
    expect(result).toEqual({ investmentIds: [], types: [] })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('maps the aggregated arrays', async () => {
    mockExecute.mockResolvedValue({ rows: [{ investment_ids: ['3', '7'], types: ['PAYOUT'] }] })
    const result = await listTransferFacets(fakePayload, {})
    expect(result).toEqual({ investmentIds: [3, 7], types: ['PAYOUT'] })
  })
})

describe('deriveFinancials', () => {
  it('returns zeros for empty array', () => {
    expect(deriveFinancials([])).toEqual(ZERO_FINANCIALS)
  })
})

describe('sumFilteredByType', () => {
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
      { type: 'INVESTMENT_EXPENSE', settled: false, total: 5000, netTotal: 0 },
      { type: 'INVESTMENT_EXPENSE', settled: true, total: 100, netTotal: 0 },
      { type: 'INVESTOR_DEPOSIT', settled: false, total: 12000, netTotal: 0 },
    ])
  })
})
