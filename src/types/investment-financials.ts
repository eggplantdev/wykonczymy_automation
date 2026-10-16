export type CategoryCostT = {
  categoryId: number
  total: number
}

export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  totalMaterialCosts: number
  /** The brutto-billed material sum — the ONLY part the global kosztorys „wszystko netto"
   *  toggle may reduce. */
  materialsGrossBase: number
  /** Σ `netAmount` of the netto expense type: already a netto figure, frozen against the toggle. */
  materialsNetBilled: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalDiscount: number
  totalLoss: number
  totalBonus: number
  totalSettled: number
  materialsNetDiscount: number
  settledCategoryCosts: CategoryCostT[]
  netCategoryCosts: CategoryCostT[]
}

export const ZERO_FINANCIALS: InvestmentFinancialsT = {
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

/** `net` is a legacy name: on a `gross` row it holds the recorded BRUTTO. */
export type MaterialsBreakdownRowT = { id: number | null; label: string; net: number } & (
  | { origin: 'gross' }
  | { origin: 'netBilled'; recordedGross: number }
)

export type CategoryTypeSettledRowT = {
  categoryId: number
  type: string
  settled: boolean
  total: number
  netTotal?: number
}

export type CategoryBreakdownsT = {
  categoryCosts: CategoryCostT[]
  netCategoryCosts: CategoryCostT[]
  netCategoryGrossCosts: CategoryCostT[]
  settledCategoryCosts: CategoryCostT[]
}

/** `netTotal` is Σ `net_amount`, non-null only for the type
 *  whose spec row bills at `netAmount`. */
export type TypeSettledTotalT = {
  type: string
  settled: boolean
  total: number
  netTotal?: number
}

export type FinancialFieldT = {
  label: string
  value: string
  amount: number
}
