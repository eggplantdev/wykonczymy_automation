import type { CategoryCostT, InvestmentFinancialsT } from '@/lib/db/sum-transfers'
import type { FinancialFieldT } from '@/types/export'
import { formatPLN } from '@/lib/format-currency'

/** Amount booked to a given expense category, 0 when that category has no rows. */
export function costForCategory(categoryCosts: CategoryCostT[], categoryId: number): number {
  return categoryCosts.find((c) => c.categoryId === categoryId)?.total ?? 0
}

/** Map ALL expense categories to header fields, showing 0 for categories with no transactions. */
function mapCategoryCostsToFields(
  categoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  return expenseCategories.map((cat) => {
    const total = costForCategory(categoryCosts, cat.id)
    return { label: cat.name, value: formatPLN(total), amount: -total }
  })
}

/** Build the shared financial header fields (category costs + totals). */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  const { categoryCosts, totalCorrections, totalIncome, totalLaborCosts, totalRabat } = financials

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
    ...(totalRabat !== 0
      ? [{ label: 'Rabat', value: formatPLN(totalRabat), amount: totalRabat }]
      : []),
  ]
}
