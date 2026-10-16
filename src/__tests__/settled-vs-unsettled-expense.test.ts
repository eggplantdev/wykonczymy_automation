import { describe, it, expect } from 'vitest'
import { deriveFinancials } from '@/lib/db/investment-financials'
import type { TypeSettledTotalT } from '@/types/investment-financials'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import type { CategoryCostT } from '@/types/investment-financials'

type FiguresT = {
  balance: number
  margin: number
  materials: number
  investmentExpenses: number
  settled: number
}

const BASE: TypeSettledTotalT[] = [
  { type: 'INVESTOR_DEPOSIT', settled: false, total: 10000 },
  { type: 'INVESTMENT_EXPENSE', settled: false, total: 3000 },
  { type: 'LABOR_COST', settled: false, total: 5000 },
  { type: 'PAYOUT', settled: false, total: 1000 },
]
const CATS: CategoryCostT[] = [{ categoryId: 1, total: 3000 }]

const figures = (rows: TypeSettledTotalT[]): FiguresT => {
  const f = deriveFinancials(rows, CATS)
  return {
    balance: calculateBalance(f),
    margin: calculateMargin(f),
    materials: f.totalMaterialCosts,
    investmentExpenses: f.categoryCosts.reduce((s, c) => s + c.total, 0),
    settled: f.totalSettled,
  }
}

const delta = (before: FiguresT, after: FiguresT) => ({
  balance: after.balance - before.balance,
  margin: after.margin - before.margin,
  materials: after.materials - before.materials,
  investmentExpenses: after.investmentExpenses - before.investmentExpenses,
  settled: after.settled - before.settled,
})

describe('settled vs unsettled expense', () => {
  const before = figures(BASE)

  it('adding a settled INVESTMENT_EXPENSE of X moves only marża (−X) and settled (+X)', () => {
    const after = figures([...BASE, { type: 'INVESTMENT_EXPENSE', settled: true, total: 500 }])
    expect(delta(before, after)).toEqual({
      balance: 0,
      margin: -500,
      materials: 0,
      investmentExpenses: 0,
      settled: 500,
    })
  })

  it('adding a settled CORRECTION of −200 moves only marża (+200) and settled (−200)', () => {
    const after = figures([...BASE, { type: 'CORRECTION', settled: true, total: -200 }])
    expect(delta(before, after)).toEqual({
      balance: 0,
      margin: 200,
      materials: 0,
      investmentExpenses: 0,
      settled: -200,
    })
  })

  it('contrast: an UNSETTLED CORRECTION of −200 moves only bilans (+200) and materiały (−200)', () => {
    const after = figures([...BASE, { type: 'CORRECTION', settled: false, total: -200 }])
    expect(delta(before, after)).toEqual({
      balance: 200,
      margin: 0,
      materials: -200,
      investmentExpenses: 0,
      settled: 0,
    })
  })
})
