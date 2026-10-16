import type { Where } from 'payload'
import { fetchFilteredByType, fetchCategoryBreakdowns } from '@/lib/queries/transfer-totals'
import { deriveFinancials } from '@/lib/db/investment-financials'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { buildFinancialFields, buildSettledFields } from '@/lib/queries/investment-financial-fields'
import { FinancialStats } from '@/components/investments/financial-stats'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { ExpenseCategoryRefT } from '@/types/reference-data'

type PropsT = {
  statsWhere: Where
  materialsNetRate: number | null
  settlementMode: SettlementModeT
  expenseCategories: ExpenseCategoryRefT[]
}

export async function InvestmentV1Stats({
  statsWhere,
  materialsNetRate,
  settlementMode,
  expenseCategories,
}: PropsT) {
  const [typeDistribution, breakdowns] = await Promise.all([
    fetchFilteredByType(statsWhere),
    fetchCategoryBreakdowns(statsWhere),
  ])

  const financials = deriveFinancials(
    typeDistribution,
    breakdowns.categoryCosts,
    breakdowns.settledCategoryCosts,
    materialsNetRate,
    settlementMode,
    breakdowns.netCategoryCosts,
  )

  return (
    <FinancialStats
      fields={buildFinancialFields(financials, expenseCategories)}
      margin={calculateMargin(financials)}
      totalPayouts={financials.totalPayouts}
      settledFields={buildSettledFields(financials.settledCategoryCosts, expenseCategories)}
    />
  )
}
