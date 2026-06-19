import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'
import { calculateBalance } from '@/lib/calculate-balance'
import { calculateMargin } from '@/lib/calculate-margin'

// The six per-investment figures shown on both the listing and the detail page.
export type InvestmentFiguresT = {
  bilans: number
  marza: number
  materialy: number
  wydatkiInwestycyjne: number
  wyplaty: number
  settled: number
}

export function extractFigures(financials: InvestmentFinancialsT): InvestmentFiguresT {
  return {
    bilans: calculateBalance(financials),
    marza: calculateMargin(
      financials.totalLaborCosts,
      financials.totalPayouts,
      financials.totalRabat,
      financials.totalLoss,
      financials.totalSettled,
    ),
    materialy: financials.totalMaterialCosts,
    wydatkiInwestycyjne: financials.categoryCosts.reduce((sum, c) => sum + c.total, 0),
    wyplaty: financials.totalPayouts,
    settled: financials.totalSettled,
  }
}
