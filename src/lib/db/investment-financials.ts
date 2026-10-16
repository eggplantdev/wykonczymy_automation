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

const isMaterialBucket = (type: string) => {
  const bucket = financialBucketOf(type)
  return bucket === 'materials' || bucket === 'materialsNet'
}

const billedTotalOf = (row: BilledRowT) => billedAmountFor(row.type, row.total, row.netTotal)

export function deriveCategoryBreakdowns(rows: CategoryTypeSettledRowT[]): CategoryBreakdownsT {
  const live = new Map<number, number>()
  const net = new Map<number, number>()
  const netGross = new Map<number, number>()
  const settled = new Map<number, number>()
  for (const r of rows) {
    if (!isMaterialBucket(r.type)) continue
    const amount = billedTotalOf(r)
    if (billsNetAmount(r.type)) {
      net.set(r.categoryId, (net.get(r.categoryId) ?? 0) + amount)
      netGross.set(r.categoryId, (netGross.get(r.categoryId) ?? 0) + r.total)
    }
    // A netto row stays live whatever its `settled` flag says — routing it to `settled` here would
    // leave the category holding a netCategoryCosts entry with no matching cost: a negative brutto row.
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
  // The base is the brutto bucket ALONE — running this off totalMaterialCosts would cut VAT off
  // materialsNetBilled a second time, which is already netto.
  const materialsNetDiscount = concessionOn(
    materialsGrossBase,
    effectiveMaterialsNetRate(settlementMode, materialsNetRate),
  )
  return {
    categoryCosts,
    totalMaterialCosts: materialsGrossBase + materialsNetBilled,
    materialsGrossBase,
    materialsNetBilled,
    totalIncome: sumBucket(rows, 'income'),
    totalLaborCosts: sumBucket(rows, 'laborCosts'),
    totalPayouts: sumBucket(rows, 'payouts'),
    totalDiscount: sumBucket(rows, 'discount'),
    totalLoss: sumBucket(rows, 'loss'),
    totalBonus: sumBucket(rows, 'bonus'),
    totalSettled: sumRows(rows, (r) => isGrossMaterial(r) && r.settled),
    materialsNetDiscount,
    settledCategoryCosts,
    netCategoryCosts,
  }
}
