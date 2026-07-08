import { describe, it, expect } from 'vitest'
import { calculateMargin } from '@/lib/db/calculate-margin'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

const fin = (p: Partial<InvestmentFinancialsT>): InvestmentFinancialsT => ({
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
  ...p,
})

describe('calculateMargin', () => {
  it('is labour minus payouts when there is no rabat', () => {
    expect(calculateMargin(fin({ totalLaborCosts: 5000, totalPayouts: 1000 }))).toBe(4000)
  })

  it('subtracts the rabat from the margin', () => {
    expect(
      calculateMargin(fin({ totalLaborCosts: 5000, totalPayouts: 1000, totalRabat: 800 })),
    ).toBe(3200)
  })

  it('subtracts the loss from the margin', () => {
    expect(
      calculateMargin(fin({ totalLaborCosts: 5000, totalPayouts: 1000, totalLoss: 700 })),
    ).toBe(3300)
  })

  it('subtracts both rabat and loss', () => {
    expect(
      calculateMargin(
        fin({ totalLaborCosts: 5000, totalPayouts: 1000, totalRabat: 800, totalLoss: 700 }),
      ),
    ).toBe(2500)
  })

  it('subtracts settled internal material from margin', () => {
    // robocizna 500, settled 100 → 400
    expect(calculateMargin(fin({ totalLaborCosts: 500, totalSettled: 100 }))).toBe(400)
  })
})
