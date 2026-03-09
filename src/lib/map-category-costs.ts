import type { CategoryCostT, InvestmentFinancialsT } from '@/lib/db/sum-transfers'
import type { HeaderFieldT } from '@/types/export'
import { formatPLN } from '@/lib/format-currency'
import { BILANS_LABEL } from '@/lib/export/header-fields'

/** Map per-category cost breakdown to header fields for display. */
function mapCategoryCostsToFields(
  categoryCosts: readonly CategoryCostT[],
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const nameMap = new Map(expenseCategories.map((c) => [c.id, c.name]))

  return categoryCosts.map((cc) => ({
    label: nameMap.get(cc.categoryId) ?? `Kategoria #${cc.categoryId}`,
    value: formatPLN(cc.total),
    amount: -cc.total,
  }))
}

/** Build the shared financial header fields (category costs + totals + bilans). */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const { categoryCosts, totalMaterialCosts, totalIncome, totalLaborCosts } = financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    {
      label: 'Koszty materiałowe',
      value: formatPLN(totalMaterialCosts),
      amount: -totalMaterialCosts,
    },
    { label: 'Koszty robocizny', value: formatPLN(totalLaborCosts), amount: -totalLaborCosts },
    { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome), amount: totalIncome },
    { label: BILANS_LABEL, value: formatPLN(totalIncome - totalMaterialCosts - totalLaborCosts) },
  ]
}
