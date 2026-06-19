import { describe, it, expect } from 'vitest'
import { deriveFinancials, type TypeSettledTotalT } from '@/lib/db/sum-transfers'
import { extractFigures, type InvestmentFiguresT } from '@/lib/investment-figures'
import type { CategoryCostT } from '@/lib/db/sum-transfers'

// The "definite test": instead of only checking listing == detail (parity), this
// checks that ADDING one transaction moves the figures exactly as the financial
// model predicts. A settled material is a company cost off the client's books —
// it must move ONLY marża and the settled bucket, never bilans or client materiały.

const BASE: TypeSettledTotalT[] = [
  { type: 'INVESTOR_DEPOSIT', settled: false, total: 10000 },
  { type: 'INVESTMENT_EXPENSE', settled: false, total: 3000 },
  { type: 'LABOR_COST', settled: false, total: 5000 },
  { type: 'PAYOUT', settled: false, total: 1000 },
]
const CATS: CategoryCostT[] = [{ categoryId: 1, total: 3000 }]

const figures = (rows: TypeSettledTotalT[]) => extractFigures(deriveFinancials(rows, CATS))

const delta = (before: InvestmentFiguresT, after: InvestmentFiguresT) => ({
  bilans: after.bilans - before.bilans,
  marza: after.marza - before.marza,
  materialy: after.materialy - before.materialy,
  wydatkiInwestycyjne: after.wydatkiInwestycyjne - before.wydatkiInwestycyjne,
  settled: after.settled - before.settled,
})

describe('settled transaction differential', () => {
  const before = figures(BASE)

  it('adding a settled INVESTMENT_EXPENSE of X moves only marża (−X) and settled (+X)', () => {
    const after = figures([...BASE, { type: 'INVESTMENT_EXPENSE', settled: true, total: 500 }])
    expect(delta(before, after)).toEqual({
      bilans: 0,
      marza: -500,
      materialy: 0,
      wydatkiInwestycyjne: 0,
      settled: 500,
    })
  })

  it('adding a settled CORRECTION of −200 moves only marża (+200) and settled (−200)', () => {
    const after = figures([...BASE, { type: 'CORRECTION', settled: true, total: -200 }])
    expect(delta(before, after)).toEqual({
      bilans: 0,
      marza: 200,
      materialy: 0,
      wydatkiInwestycyjne: 0,
      settled: -200,
    })
  })

  it('contrast: an UNSETTLED CORRECTION of −200 moves only bilans (+200) and materiały (−200)', () => {
    const after = figures([...BASE, { type: 'CORRECTION', settled: false, total: -200 }])
    expect(delta(before, after)).toEqual({
      bilans: 200,
      marza: 0,
      materialy: -200,
      wydatkiInwestycyjne: 0,
      settled: 0,
    })
  })
})
