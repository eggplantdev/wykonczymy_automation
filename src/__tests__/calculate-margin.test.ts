import { describe, it, expect } from 'vitest'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { deriveFinancials } from '@/lib/db/investment-financials'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

const fin = (p: Partial<InvestmentFinancialsT>): InvestmentFinancialsT => ({
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
  ...p,
})

describe('calculateMargin', () => {
  it('is labour minus payouts when there is no rabat', () => {
    expect(calculateMargin(fin({ totalLaborCosts: 5000, totalPayouts: 1000 }))).toBe(4000)
  })

  it('subtracts the rabat from the margin', () => {
    expect(
      calculateMargin(fin({ totalLaborCosts: 5000, totalPayouts: 1000, totalDiscount: 800 })),
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
        fin({ totalLaborCosts: 5000, totalPayouts: 1000, totalDiscount: 800, totalLoss: 700 }),
      ),
    ).toBe(2500)
  })

  it('puts the absorbed cost on the company when nothing was billed', () => {
    expect(calculateMargin(fin({ totalLoss: 362.84 }))).toBeCloseTo(-362.84, 10)
  })

  it('ignores the premia', () => {
    const paid = fin({ totalLaborCosts: 5000, totalPayouts: 1000 })
    expect(calculateMargin({ ...paid, totalBonus: 205.01 })).toBe(calculateMargin(paid))
  })

  it('subtracts settled internal material from margin', () => {
    expect(calculateMargin(fin({ totalLaborCosts: 500, totalSettled: 100 }))).toBe(400)
  })
})

describe('calculateMargin — the netto expense type moves nothing', () => {
  const withExpense = (type: string) =>
    deriveFinancials([
      { type: 'LABOR_COST', settled: false, total: 5000 },
      { type: 'PAYOUT', settled: false, total: 1000 },
      { type, settled: false, total: 1230, netTotal: 1000 },
    ])

  it('is identical for a brutto and a netto investment expense', () => {
    expect(calculateMargin(withExpense('INVESTMENT_EXPENSE_NET'))).toBe(
      calculateMargin(withExpense('INVESTMENT_EXPENSE')),
    )
  })

  it('equals robocizna − wypłaty — materiały never entered it', () => {
    expect(calculateMargin(withExpense('INVESTMENT_EXPENSE_NET'))).toBe(4000)
  })
})
