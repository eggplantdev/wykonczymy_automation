import { describe, it, expect } from 'vitest'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { ZERO_FINANCIALS } from '@/types/investment-financials'

describe('calculateBalance', () => {
  it('is income minus material and labour costs when there is no rabat', () => {
    expect(
      calculateBalance({
        ...ZERO_FINANCIALS,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
      }),
    ).toBe(5000)
  })

  it('adds the rabat so the client owes less', () => {
    expect(
      calculateBalance({
        ...ZERO_FINANCIALS,
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
        ...ZERO_FINANCIALS,
        totalIncome: 10000,
        totalMaterialCosts: 3000,
        totalLaborCosts: 2000,
        totalLoss: 1500,
      }),
    ).toBe(6500)
  })

  it('ignores the premia', () => {
    const owed = {
      ...ZERO_FINANCIALS,
      totalIncome: 10000,
      totalMaterialCosts: 3000,
      totalLaborCosts: 2000,
    }
    expect(calculateBalance({ ...owed, totalBonus: 205.01 })).toBe(calculateBalance(owed))
  })
})
