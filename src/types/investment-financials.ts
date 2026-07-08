export type CategoryCostT = {
  categoryId: number
  total: number
}

export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  totalMaterialCosts: number
  totalCorrections: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalRabat: number
  totalLoss: number
  totalSettled: number
  settledCategoryCosts: CategoryCostT[]
}

export type CategoryTypeSettledRowT = {
  categoryId: number
  type: string
  settled: boolean
  total: number
}

export type CategoryBreakdownsT = {
  categoryCosts: CategoryCostT[]
  settledCategoryCosts: CategoryCostT[]
}

/** Raw per-(type, settled) sum for one investment — the input both code paths feed
 *  into deriveFinancials(). */
export type TypeSettledTotalT = { type: string; settled: boolean; total: number }
