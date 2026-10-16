import { describe, it, expect } from 'vitest'
import { deriveFinancials } from '@/lib/db/investment-financials'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { calculateBalance } from '@/lib/db/calculate-balance'

// 123 brutto at 23% is 100 netto, so the concession is 23 — NOT 123 × 0,23 = 28,29.
const RATE = 0.23

const grossRow = (total: number) => ({ type: 'INVESTMENT_EXPENSE', settled: false, total })
const netRow = (total: number, netTotal: number) => ({
  type: 'INVESTMENT_EXPENSE_NET',
  settled: false,
  total,
  netTotal,
})

describe('deriveFinancials — materialsNetDiscount', () => {
  it('is 0 when no rate is set — every investment that exists today', () => {
    expect(deriveFinancials([grossRow(123)]).materialsNetDiscount).toBe(0)
  })

  it('prices 123 brutto at 100 netto on a netto-settled investment', () => {
    const { materialsNetDiscount } = deriveFinancials([grossRow(123)], [], [], RATE, 'NET')
    expect(materialsNetDiscount).toBeCloseTo(23, 10)
  })

  it('does the same in tryb mieszany — materiały sit wholly inside its netto section', () => {
    const { materialsNetDiscount } = deriveFinancials([grossRow(123)], [], [], RATE, 'MIXED')
    expect(materialsNetDiscount).toBeCloseTo(23, 10)
  })

  it('is 0 on a brutto-settled investment — VAT is added on top there, nothing to strip', () => {
    const { materialsNetDiscount } = deriveFinancials([grossRow(123)], [], [], RATE, 'GROSS')
    expect(materialsNetDiscount).toBe(0)
  })

  it('is 0 at a 0% rate, which stays distinct from an unset rate only by intent', () => {
    expect(deriveFinancials([grossRow(123)], [], [], 0, 'NET').materialsNetDiscount).toBe(0)
  })

  // Basing the discount on totalMaterialCosts — the sum of both buckets — is the one
  // edit that reintroduces the double cut, and it has to turn this red.
  it('never touches the already-netto bucket', () => {
    const financials = deriveFinancials([grossRow(123), netRow(123, 100)], [], [], RATE, 'NET')
    expect(financials.totalMaterialCosts).toBe(223)
    expect(financials.materialsNetDiscount).toBeCloseTo(23, 10)
  })

  it('excludes settled material — it is never billed to the investor', () => {
    const settled = { type: 'INVESTMENT_EXPENSE', settled: true, total: 123 }
    const financials = deriveFinancials([settled], [], [], RATE, 'NET')
    expect(financials.materialsNetDiscount).toBe(0)
  })
})

describe('the concession is two-sided — marża down, bilans up by the same amount', () => {
  const rows = [grossRow(123), { type: 'LABOR_COST', settled: false, total: 1000 }]
  const off = deriveFinancials(rows)
  const on = deriveFinancials(rows, [], [], RATE, 'NET')

  it('lowers marża by exactly the discount', () => {
    expect(calculateMargin(off) - calculateMargin(on)).toBeCloseTo(23, 10)
  })

  it('raises bilans by exactly the discount', () => {
    expect(calculateBalance(on) - calculateBalance(off)).toBeCloseTo(23, 10)
  })

  it('leaves both figures untouched when no rate is set', () => {
    expect(calculateMargin(off)).toBe(1000 - 0)
    expect(calculateBalance(off)).toBe(-1123)
  })
})
