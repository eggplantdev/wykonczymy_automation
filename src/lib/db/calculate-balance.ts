import type { InvestmentFinancialsT } from '@/types/investment-financials'

// Material costs already include corrections (negative corrections reduce costs).
export function calculateBalance(financials: InvestmentFinancialsT) {
  const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
  return (
    financials.totalIncome -
    totalCosts +
    financials.totalDiscount +
    financials.materialsNetDiscount +
    financials.totalLoss
  )
}
