import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  deriveCategoryBreakdowns,
  deriveFinancials,
} from '@/lib/db/sum-transfers'
import { extractFigures } from '@/lib/investment-figures'

const mockExecute = vi.fn()
const fakePayload = {
  db: { drizzle: { execute: mockExecute }, sessions: {} },
} as unknown as Payload

beforeEach(() => mockExecute.mockReset())

// One synthetic investment's transactions, expressed as the rows each query would
// return from Postgres. listing = grouped-by-(type,settled) with investment_id;
// detail = same minus investment_id. Category rows now group by (category,type,settled)
// — the SAME shape for both paths (the old category_total vs total alias split is gone).
const TYPE_ROWS = [
  { type: 'INVESTMENT_EXPENSE', settled: false, total: '3000' },
  { type: 'CORRECTION', settled: true, total: '-200' }, // the divergence case — has a category below
  { type: 'INVESTOR_DEPOSIT', settled: false, total: '10000' },
  { type: 'LABOR_COST', settled: false, total: '800' },
  { type: 'PAYOUT', settled: false, total: '300' },
]
const CATEGORY_ROWS = [
  { expense_category_id: '1', type: 'INVESTMENT_EXPENSE', settled: false, total: '3000' },
  { expense_category_id: '1', type: 'CORRECTION', settled: true, total: '-200' },
]

describe('listing vs detail figure parity', () => {
  it('produces identical figures and category breakdowns (incl. settled CORRECTION)', async () => {
    // Listing path: main query rows carry investment_id; category query rows too.
    mockExecute
      .mockResolvedValueOnce({ rows: TYPE_ROWS.map((r) => ({ investment_id: '1', ...r })) })
      .mockResolvedValueOnce({ rows: CATEGORY_ROWS.map((r) => ({ investment_id: '1', ...r })) })
    const listingFin = (await sumAllInvestmentFinancials(fakePayload)).get(1)!

    // Detail path: sumFilteredByType, then one category query → deriveCategoryBreakdowns.
    mockExecute.mockReset()
    mockExecute
      .mockResolvedValueOnce({ rows: TYPE_ROWS }) // sumFilteredByType
      .mockResolvedValueOnce({ rows: CATEGORY_ROWS }) // sumCategoryByTypeSettled
    const where = { investment: { equals: 1 } }
    const byType = await sumFilteredByType(fakePayload, where)
    const breakdowns = deriveCategoryBreakdowns(await sumCategoryByTypeSettled(fakePayload, where))
    const detailFin = deriveFinancials(
      byType,
      breakdowns.categoryCosts,
      breakdowns.settledCategoryCosts,
    )

    expect(extractFigures(listingFin)).toEqual(extractFigures(detailFin))
    // Both paths must agree on the per-category settled split, not just the headline.
    expect(listingFin.settledCategoryCosts).toEqual(detailFin.settledCategoryCosts)

    const f = extractFigures(detailFin)
    expect(f.materialy).toBe(3000) // settled CORRECTION excluded from materials
    expect(f.settled).toBe(-200) // settled CORRECTION moved the headline

    // The fix-for-good guarantee: the settled category buttons SUM to the headline.
    const settledSum = detailFin.settledCategoryCosts.reduce((s, c) => s + c.total, 0)
    expect(settledSum).toBe(f.settled)
  })
})
