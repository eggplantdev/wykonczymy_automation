import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

// Bilans inwestora (investor balance) = income - material costs - labor costs
// Material costs already include corrections (negative corrections reduce costs).
export function calculateBalance(financials: InvestmentFinancialsT) {
  const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
  return financials.totalIncome - totalCosts
}
