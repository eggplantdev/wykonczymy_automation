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

  // The reference shape (investment 62): 362,84 of material the owner covered with a strata of the
  // same amount, nothing billed. Bilans closes at zero, and the whole cost lands on the margin.
  it('puts the absorbed cost on the company when nothing was billed', () => {
    expect(calculateMargin(fin({ totalLoss: 362.84 }))).toBeCloseTo(-362.84, 10)
  })

  // EX-979: on v1 the premia's money already left as the wypłata it covers — charging it again would
  // count the overpayment twice.
  it('ignores the premia', () => {
    const paid = fin({ totalLaborCosts: 5000, totalPayouts: 1000 })
    expect(calculateMargin({ ...paid, totalBonus: 205.01 })).toBe(calculateMargin(paid))
  })

  it('subtracts settled internal material from margin', () => {
    // robocizna 500, settled 100 → 400
    expect(calculateMargin(fin({ totalLaborCosts: 500, totalSettled: 100 }))).toBe(400)
  })
})

// GUARD B3 — marża is blind to the brutto/netto choice. Run through the real derivation
// rather than hand-built financials: the risk is that the netto type leaks into a bucket
// marża reads (totalSettled), and only deriveFinancials decides that.
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
