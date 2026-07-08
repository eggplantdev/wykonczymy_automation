import type { InvestmentFinancialsT } from '@/types/investment-financials'

// Bilans inwestora (investor balance) = income - material costs - labor costs + rabat.
// Material costs already include corrections (negative corrections reduce costs).
// A rabat is a labour discount: the client owes less, so it RAISES the balance.
export function calculateBalance(financials: InvestmentFinancialsT) {
  const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
  return financials.totalIncome - totalCosts + financials.totalRabat
}
