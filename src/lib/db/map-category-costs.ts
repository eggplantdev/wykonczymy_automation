import type {
  CategoryCostT,
  InvestmentFinancialsT,
  MaterialyBreakdownRowT,
} from '@/types/investment-financials'
import type { FinancialFieldT } from '@/types/export'
import { formatPLN } from '@/lib/utils/format-currency'

// Material spend not attributed to any expense category — in practice legacy corrections
// entered before the category became required. It counts toward totalMaterialCosts, so it
// MUST surface as its own row wherever the category split is shown, or the sum drifts below
// the listing's bilans.
const KOREKTA_LABEL = 'Korekta (bez kategorii)'

/** Amount booked to a given expense category, 0 when that category has no rows. */
export function costForCategory(categoryCosts: CategoryCostT[], categoryId: number): number {
  return categoryCosts.find((c) => c.categoryId === categoryId)?.total ?? 0
}

function uncategorisedRemainder(financials: InvestmentFinancialsT): number {
  const categorised = financials.categoryCosts.reduce((sum, c) => sum + c.total, 0)
  return financials.totalMaterialCosts - categorised
}

/** The kosztorys „Materiały" split — one row per expense category (v1 mirror parity:
 *  Materiały budowlane / wykończeniowe / Pozostałe koszty), plus the uncategorised remainder,
 *  so Σ rows === totalMaterialCosts and the podsumowanie reconciles with the investment page's
 *  materiały byte-for-byte. */
export function buildMaterialyBreakdown(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
): MaterialyBreakdownRowT[] {
  const rows: MaterialyBreakdownRowT[] = expenseCategories.map((cat) => ({
    id: cat.id,
    label: cat.name,
    net: costForCategory(financials.categoryCosts, cat.id),
  }))
  const uncategorised = uncategorisedRemainder(financials)
  if (uncategorised !== 0) rows.push({ id: null, label: KOREKTA_LABEL, net: uncategorised })
  return rows
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
  const { categoryCosts, totalIncome, totalLaborCosts, totalRabat } = financials
  const uncategorised = uncategorisedRemainder(financials)

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    ...(uncategorised !== 0
      ? [
          {
            label: KOREKTA_LABEL,
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
