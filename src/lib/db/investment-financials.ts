import {
  billedAmountFor,
  billsNetAmount,
  financialBucketOf,
  type FinancialBucketT,
} from '@/lib/constants/transfers'
import type {
  CategoryBreakdownsT,
  CategoryCostT,
  CategoryTypeSettledRowT,
  InvestmentFinancialsT,
  TypeSettledTotalT,
} from '@/types/investment-financials'
import {
  effectiveMaterialsNetRate,
  SETTLEMENT_MODE_DEFAULT,
  type SettlementModeT,
} from '@/lib/kosztorys/settlement-mode'
import { materialsNetDiscount as concessionOn } from '@/lib/kosztorys/summary-economics'

type BilledRowT = { type: string; total: number; netTotal?: number }

// Two material buckets, one question. `materials` is billed brutto and may be reduced by
// the kosztorys „wszystko netto" toggle; `materialsNet` is already netto and must not be.
const isMaterialBucket = (type: string) => {
  const bucket = financialBucketOf(type)
  return bucket === 'materials' || bucket === 'materialsNet'
}

const billedTotalOf = (row: BilledRowT) => billedAmountFor(row.type, row.total, row.netTotal)

/**
 * Single source of truth for the per-category split — mirrors deriveFinancials by reading
 * the same `financialBucket` column, so settledCategoryCosts reconciles with totalSettled
 * by construction and the "Materiały wliczone w robociznę" buttons sum to the headline.
 */
export function deriveCategoryBreakdowns(rows: CategoryTypeSettledRowT[]): CategoryBreakdownsT {
  const live = new Map<number, number>()
  const net = new Map<number, number>()
  const netGross = new Map<number, number>()
  const settled = new Map<number, number>()
  for (const r of rows) {
    if (!isMaterialBucket(r.type)) continue
    const amount = billedTotalOf(r)
    // The netto rows land in BOTH maps: `categoryCosts` stays the full billed figure (so
    // Σ still reconciles with totalMaterialCosts), `netCategoryCosts` names the part a
    // consumer must freeze against the global „wszystko netto" toggle.
    if (billsNetAmount(r.type)) {
      net.set(r.categoryId, (net.get(r.categoryId) ?? 0) + amount)
      netGross.set(r.categoryId, (netGross.get(r.categoryId) ?? 0) + r.total)
    }
    // A netto row stays live whatever its `settled` flag says — deriveFinancials folds it into
    // materialsNetBilled unconditionally, and routing it to `settled` here would leave the
    // category holding a netCategoryCosts entry with no matching cost: a negative brutto row.
    const bucket = r.settled && !billsNetAmount(r.type) ? settled : live
    bucket.set(r.categoryId, (bucket.get(r.categoryId) ?? 0) + amount)
  }
  const toCosts = (m: Map<number, number>): CategoryCostT[] =>
    [...m].map(([categoryId, total]) => ({ categoryId, total }))
  return {
    categoryCosts: toCosts(live),
    netCategoryCosts: toCosts(net),
    netCategoryGrossCosts: toCosts(netGross),
    settledCategoryCosts: toCosts(settled),
  }
}

const sumRows = (rows: TypeSettledTotalT[], pred: (r: TypeSettledTotalT) => boolean): number =>
  rows.reduce((acc, r) => (pred(r) ? acc + billedTotalOf(r) : acc), 0)

const sumBucket = (rows: TypeSettledTotalT[], bucket: FinancialBucketT): number =>
  sumRows(rows, (r) => financialBucketOf(r.type) === bucket)

/** The listing and the detail page both funnel through here, so the bucketing rule
 *  cannot differ between the two views. */
// Both trailing params default to "no concession", so a surface that cannot supply them (reports,
// the client share) reads exactly what an investment with no rate set reads — "can't compute it"
// and "there is nothing to compute" collapse into one safe value instead of two behaviours.
export function deriveFinancials(
  rows: TypeSettledTotalT[],
  categoryCosts: CategoryCostT[] = [],
  settledCategoryCosts: CategoryCostT[] = [],
  materialsNetRate: number | null = null,
  settlementMode: SettlementModeT = SETTLEMENT_MODE_DEFAULT,
  netCategoryCosts: CategoryCostT[] = [],
): InvestmentFinancialsT {
  const isGrossMaterial = (r: TypeSettledTotalT) => financialBucketOf(r.type) === 'materials'
  const isNetMaterial = (r: TypeSettledTotalT) => financialBucketOf(r.type) === 'materialsNet'
  const materialsGrossBase = sumRows(rows, (r) => isGrossMaterial(r) && !r.settled)
  // Not split on `settled`: the netto type is `settleable: false`, so a settled netto row
  // cannot exist — and if one ever did, dropping it here would hide it from every figure.
  const materialsNetBilled = sumRows(rows, isNetMaterial)
  // The gate is applied here, not left to the readers, so no surface can forget it. The base is the
  // brutto bucket ALONE — running this off totalMaterialCosts would cut VAT off materialsNetBilled a
  // second time, which is already netto. The arithmetic itself is the panel's, imported rather than
  // restated, so the marża term and the row that explains it cannot drift apart.
  const materialsNetDiscount = concessionOn(
    materialsGrossBase,
    effectiveMaterialsNetRate(settlementMode, materialsNetRate),
  )
  return {
    categoryCosts,
    // The only bucket that splits on the per-ROW settled flag: settled material has been
    // priced into robocizna, so it leaves materiały/bilans and lowers margin instead.
    totalMaterialCosts: materialsGrossBase + materialsNetBilled,
    materialsGrossBase,
    materialsNetBilled,
    totalIncome: sumBucket(rows, 'income'),
    totalLaborCosts: sumBucket(rows, 'laborCosts'),
    totalPayouts: sumBucket(rows, 'payouts'),
    totalDiscount: sumBucket(rows, 'discount'),
    totalLoss: sumBucket(rows, 'loss'),
    totalSettled: sumRows(rows, (r) => isGrossMaterial(r) && r.settled),
    materialsNetDiscount,
    settledCategoryCosts,
    netCategoryCosts,
  }
}
