import {
  buildMaterialsBreakdown,
  buildSettledBreakdown,
} from '@/lib/queries/investment-financial-fields'
import { deriveFinancials } from '@/lib/db/investment-financials'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { fetchCategoryBreakdowns, fetchFilteredByType } from '@/lib/queries/transfer-totals'
import type {
  CategoryBreakdownsT,
  InvestmentFinancialsT,
  MaterialsBreakdownRowT,
  TypeSettledTotalT,
} from '@/types/investment-financials'

export type InvestmentFinancialsSourceT = {
  typeDistribution: TypeSettledTotalT[]
  breakdowns: CategoryBreakdownsT
}

/**
 * Fetch and derive stay separate on purpose: deriving needs the tree's rate + mode, so a helper that
 * fetched AND derived could only run once the tree resolved — turning one parallel round of queries
 * into two serial ones behind the page's long pole.
 */
export async function fetchWholeInvestmentFinancials(
  investmentId: number,
): Promise<InvestmentFinancialsSourceT> {
  const investmentWhere = { investment: { equals: investmentId } }
  const [typeDistribution, breakdowns] = await Promise.all([
    fetchFilteredByType(investmentWhere),
    fetchCategoryBreakdowns(investmentWhere),
  ])
  return { typeDistribution, breakdowns }
}

export type WholeInvestmentFinancialsT = {
  financials: InvestmentFinancialsT
  /** Σ rows === `financials.totalMaterialCosts`. */
  materialsBreakdown: MaterialsBreakdownRowT[]
  settledBreakdown: MaterialsBreakdownRowT[]
}

export function deriveWholeInvestmentFinancials(
  { typeDistribution, breakdowns }: InvestmentFinancialsSourceT,
  settings: { materialsNetRate: number | null; settlementMode: SettlementModeT },
  expenseCategories: { id: number; name: string }[],
): WholeInvestmentFinancialsT {
  const financials = deriveFinancials(
    typeDistribution,
    breakdowns.categoryCosts,
    breakdowns.settledCategoryCosts,
    settings.materialsNetRate,
    settings.settlementMode,
    breakdowns.netCategoryCosts,
  )
  return {
    financials,
    materialsBreakdown: buildMaterialsBreakdown(financials, expenseCategories, breakdowns),
    settledBreakdown: buildSettledBreakdown(breakdowns.settledCategoryCosts, expenseCategories),
  }
}
