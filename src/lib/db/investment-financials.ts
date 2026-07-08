import { DEPOSIT_TYPES, isExpensesTabType } from '@/lib/constants/transfers'
import type {
  CategoryBreakdownsT,
  CategoryCostT,
  CategoryTypeSettledRowT,
  InvestmentFinancialsT,
  TypeSettledTotalT,
} from '@/types/investment-financials'

/**
 * Single source of truth for the per-category split — mirrors deriveFinancials:
 * only material-expense types (INVESTMENT_EXPENSE + CORRECTION) count, split by the
 * settled flag. settledCategoryCosts therefore reconciles with totalSettled by
 * construction, so the "Materiały wliczone w robociznę" buttons sum to the headline.
 */
export function deriveCategoryBreakdowns(rows: CategoryTypeSettledRowT[]): CategoryBreakdownsT {
  const live = new Map<number, number>()
  const settled = new Map<number, number>()
  for (const r of rows) {
    if (!isExpensesTabType(r.type)) continue
    const bucket = r.settled ? settled : live
    bucket.set(r.categoryId, (bucket.get(r.categoryId) ?? 0) + r.total)
  }
  const toCosts = (m: Map<number, number>): CategoryCostT[] =>
    [...m].map(([categoryId, total]) => ({ categoryId, total }))
  return { categoryCosts: toCosts(live), settledCategoryCosts: toCosts(settled) }
}

const sumRows = (rows: TypeSettledTotalT[], pred: (r: TypeSettledTotalT) => boolean): number =>
  rows.reduce((acc, r) => (pred(r) ? acc + r.total : acc), 0)

/** Derive financials from a raw (type, settled) distribution. Single source of truth
 *  for the bucketing rule — both the listing and the detail page feed this. */
export function deriveFinancials(
  rows: TypeSettledTotalT[],
  categoryCosts: CategoryCostT[] = [],
  settledCategoryCosts: CategoryCostT[] = [],
): InvestmentFinancialsT {
  return {
    categoryCosts,
    totalMaterialCosts: sumRows(rows, (r) => isExpensesTabType(r.type) && !r.settled),
    totalCorrections: sumRows(rows, (r) => r.type === 'CORRECTION' && !r.settled),
    totalIncome: sumRows(rows, (r) => (DEPOSIT_TYPES as readonly string[]).includes(r.type)),
    totalLaborCosts: sumRows(rows, (r) => r.type === 'LABOR_COST'),
    totalPayouts: sumRows(rows, (r) => r.type === 'PAYOUT'),
    totalRabat: sumRows(rows, (r) => r.type === 'RABAT'),
    totalLoss: sumRows(rows, (r) => r.type === 'LOSS'),
    // Settled material is symmetric for INVESTMENT_EXPENSE and CORRECTION: it leaves
    // materials/bilans and lowers margin via this bucket.
    totalSettled: sumRows(rows, (r) => isExpensesTabType(r.type) && r.settled),
    settledCategoryCosts,
  }
}
