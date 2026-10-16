import { describe, it, expect } from 'vitest'
import { calculateBalance } from '@/lib/db/calculate-balance'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

const base: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  materialsGrossBase: 0,
  materialsNetBilled: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalDiscount: 0,
  totalLoss: 0,
  totalBonus: 0,
  totalSettled: 0,
  materialsNetDiscount: 0,
  settledCategoryCosts: [],
  netCategoryCosts: [],
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
        totalDiscount: 800,
      }),
    ).toBe(5800)
  })

  it('adds the loss so the client owes less', () => {
    expect(
      calculateBalance({
        ...base,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
        totalLoss: 1500,
      }),
    ).toBe(6500)
  })

  it('ignores the premia', () => {
    const owed = { ...base, totalIncome: 10000, totalMaterialCosts: 3000, totalLaborCosts: 2000 }
    expect(calculateBalance({ ...owed, totalBonus: 205.01 })).toBe(calculateBalance(owed))
  })

  it('cancels an expense covered by a loss of the same amount', () => {
    expect(
      calculateBalance({ ...base, totalMaterialCosts: 362.84, totalLoss: 362.84 }),
    ).toBeCloseTo(0, 10)
  })
})
