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
// return from Postgres. listing = grouped-by-(type,settled) with investment_id;
// detail = same minus investment_id. Category rows shared.
const TYPE_ROWS = [
  { type: 'INVESTMENT_EXPENSE', settled: false, total: '3000' },
  { type: 'CORRECTION', settled: true, total: '-200' }, // the divergence case
  { type: 'INVESTOR_DEPOSIT', settled: false, total: '10000' },
  { type: 'LABOR_COST', settled: false, total: '800' },
  { type: 'PAYOUT', settled: false, total: '300' },
]
// The listing query aliases the category sum AS category_total; sumCategoryBreakdown
// (detail) aliases it AS total — so the mock rows differ by that column name only.
const LISTING_CATEGORY_ROWS = [
  { investment_id: '1', expense_category_id: '1', category_total: '3000' },
]
const DETAIL_CATEGORY_ROWS = [{ expense_category_id: '1', total: '3000' }]

describe('listing vs detail figure parity', () => {
  it('produces identical figures for the same transactions (incl. settled CORRECTION)', async () => {
    // Listing path: main query rows carry investment_id; category query rows too.
    mockExecute
      .mockResolvedValueOnce({ rows: TYPE_ROWS.map((r) => ({ investment_id: '1', ...r })) })
      .mockResolvedValueOnce({ rows: LISTING_CATEGORY_ROWS })
    const listingFin = (await sumAllInvestmentFinancials(fakePayload)).get(1)!

    // Detail path: sumFilteredByType, then sumCategoryBreakdown, then settled breakdown.
    mockExecute.mockReset()
    mockExecute
      .mockResolvedValueOnce({ rows: TYPE_ROWS }) // sumFilteredByType
      .mockResolvedValueOnce({ rows: DETAIL_CATEGORY_ROWS }) // sumCategoryBreakdown
      .mockResolvedValueOnce({ rows: [] }) // sumSettledCategoryBreakdown
    const where = { investment: { equals: 1 } }
    const byType = await sumFilteredByType(fakePayload, where)
    const cats = await sumCategoryBreakdown(fakePayload, where)
    const settledCats = await sumSettledCategoryBreakdown(fakePayload, where)
    const detailFin = deriveFinancials(byType, cats, settledCats)

    expect(extractFigures(listingFin)).toEqual(extractFigures(detailFin))

    // And the settled correction did NOT touch materials, but DID move totalSettled:
    const f = extractFigures(detailFin)
    expect(f.materialy).toBe(3000) // settled CORRECTION excluded
    expect(f.settled).toBe(-200)
  })
})
