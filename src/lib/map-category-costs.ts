import type { CategoryCostT, InvestmentFinancialsT } from '@/lib/db/sum-transfers'
import type { HeaderFieldT } from '@/types/export'
import { formatPLN } from '@/lib/format-currency'
import { BILANS_LABEL } from '@/lib/export/header-fields'

/** Map ALL expense categories to header fields, showing 0 for categories with no transactions. */
function mapCategoryCostsToFields(
  categoryCosts: readonly CategoryCostT[],
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const costMap = new Map(categoryCosts.map((cc) => [cc.categoryId, cc.total]))

  return expenseCategories.map((cat) => {
    const total = costMap.get(cat.id) ?? 0
    return { label: cat.name, value: formatPLN(total), amount: -total }
  })
}

/** Build the shared financial header fields (category costs + totals + bilans). */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const { categoryCosts, totalMaterialCosts, totalIncome, totalLaborCosts, totalPayouts } =
    financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    {
      label: 'Koszty robocizny',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
      pairedWith: 'Wypłaty',
    },
    {
      label: 'Wypłaty',
      value: formatPLN(totalPayouts),
      amount: -totalPayouts,
      pairedWith: 'Koszty robocizny',
      defaultHidden: true,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
    { label: BILANS_LABEL, value: formatPLN(totalIncome - totalMaterialCosts - totalLaborCosts) },
  ]
}
