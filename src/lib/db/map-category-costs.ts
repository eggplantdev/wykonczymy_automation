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
  const { categoryCosts, totalIncome, totalLaborCosts, totalRabat, totalMaterialCosts } = financials

  // Material costs not attributed to any expense category — in practice legacy
  // corrections entered before the category became required. They count toward
  // totalMaterialCosts (and thus the listing's bilans), so they MUST appear here too,
  // otherwise the detail bilans (sum of these fields) drifts below the listing's.
  const categorised = categoryCosts.reduce((sum, c) => sum + c.total, 0)
  const uncategorised = totalMaterialCosts - categorised

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    ...(uncategorised !== 0
      ? [
          {
            label: 'Korekta (bez kategorii)',
            value: formatPLN(uncategorised),
            amount: -uncategorised,
          },
        ]
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

/** Build labelled fields for settled internal material, split per expense category.
 *  Positive amounts (display only) — these live OUTSIDE the bilans toggle sum. */
export function buildSettledFields(
  settledCategoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(settledCategoryCosts, cat.id) }))
    .filter(({ total }) => total !== 0)
    .map(({ cat, total }) => ({ label: cat.name, value: formatPLN(total), amount: total }))
}
