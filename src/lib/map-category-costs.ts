import type { CategoryCostT, InvestmentFinancialsT } from '@/lib/db/sum-transfers'
import type { FinancialFieldT } from '@/types/export'
import { formatPLN } from '@/lib/format-currency'

/** Map ALL expense categories to header fields, showing 0 for categories with no transactions. */
function mapCategoryCostsToFields(
  categoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  const costMap = new Map(categoryCosts.map((cc) => [cc.categoryId, cc.total]))

  return expenseCategories.map((cat) => {
    const total = costMap.get(cat.id) ?? 0
    return { label: cat.name, value: formatPLN(total), amount: -total }
  })
}

/** Build the shared financial header fields (category costs + totals). */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  const { categoryCosts, totalCorrections, totalIncome, totalLaborCosts } = financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    ...(totalCorrections !== 0
      ? [{ label: 'Korekty', value: formatPLN(totalCorrections), amount: -totalCorrections }]
      : []),
    {
      label: 'Robocizna',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
  ]
}
