import { describe, it, expect } from 'vitest'
import { calculateBalance } from '@/lib/db/calculate-balance'
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

describe('calculateBalance', () => {
  it('is income minus material and labour costs when there is no rabat', () => {
    expect(
      calculateBalance({
        ...base,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
      }),
    ).toBe(5000)
  })

  it('adds the rabat so the client owes less', () => {
    expect(
      calculateBalance({
        ...base,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
        totalRabat: 800,
      }),
    ).toBe(5800)
  })

  it('ignores losses — strata is the company cost, not the investor cost', () => {
    expect(
      calculateBalance({
        ...base,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
        totalLoss: 1500,
      }),
    ).toBe(5000)
  })
})
