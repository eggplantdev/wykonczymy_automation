import type {
  CategoryCostT,
  FinancialFieldT,
  InvestmentFinancialsT,
  MaterialsBreakdownRowT,
} from '@/types/investment-financials'
import {
  CORRECTION_LABEL,
  DISCOUNT_LABEL,
  INCOME_LABEL,
  LABOR_LABEL,
  LOSS_LABEL,
  MATERIALS_DISCOUNT_LABEL,
} from '@/lib/constants/financial-field-labels'
import { costForCategory } from '@/lib/utils/category-costs'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'

// Rounded because the `!== 0` guards below are the seam where this becomes a rendered row: a float
// residue between two SQL sums otherwise shows up as a „Korekta (bez kategorii)" row reading 0,00.
function uncategorisedRemainder(financials: InvestmentFinancialsT): number {
  const categorised = financials.categoryCosts.reduce((sum, c) => sum + c.total, 0)
  return roundToCents(financials.totalMaterialCosts - categorised)
}

/** One row per expense category plus the uncategorised remainder, so Σ rows === totalMaterialCosts
 *  and the podsumowanie reconciles with the investment page byte-for-byte.
 *
 *  A category billed partly at netto splits into a brutto remainder and a frozen netto row under the
 *  same id and bare category name — the „… netto" wording is `pricedBreakdownRows`' to add, since the
 *  investor's per-category merge must not have to strip it.
 *  `netCategoryCosts` is a subset of `financials.categoryCosts`, so subtracting it keeps the Σ
 *  invariant intact. The netto rows come as a block rather than interleaved per category: beside
 *  their brutto twin they read as a sub-row and invite summing the pair. */
export function buildMaterialsBreakdown(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
  netCategoryCosts: CategoryCostT[] = [],
  netCategoryGrossCosts: CategoryCostT[] = [],
): MaterialsBreakdownRowT[] {
  // Zeros dropped: consumers gate on `rows.length` to decide whether the „Materiały" tab has content,
  // so a placeholder per empty category blanked the tab.
  const grossRows: MaterialsBreakdownRowT[] = expenseCategories
    .map((cat) => ({
      id: cat.id,
      label: cat.name,
      net:
        costForCategory(financials.categoryCosts, cat.id) -
        costForCategory(netCategoryCosts, cat.id),
      origin: 'gross' as const,
    }))
    .filter((row) => row.net !== 0)
  const uncategorised = uncategorisedRemainder(financials)
  if (uncategorised !== 0)
    grossRows.push({ id: null, label: CORRECTION_LABEL, net: uncategorised, origin: 'gross' })

  const netRows: MaterialsBreakdownRowT[] = expenseCategories
    .map((cat) => ({ cat, netBilled: costForCategory(netCategoryCosts, cat.id) }))
    .filter(({ netBilled }) => netBilled !== 0)
    .map(({ cat, netBilled }) => ({
      id: cat.id,
      label: cat.name,
      net: netBilled,
      origin: 'netBilled' as const,
      recordedGross: costForCategory(netCategoryGrossCosts, cat.id),
    }))

  return [...grossRows, ...netRows]
}

/** By default ALL categories, showing 0 for one with no transactions: the export header and the v1
 *  reading both rely on a stable column set. */
function mapCategoryCostsToFields(
  categoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
  hideZeroCosts: boolean,
): FinancialFieldT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(categoryCosts, cat.id) }))
    .filter(({ total }) => !hideZeroCosts || total !== 0)
    .map(({ cat, total }) => ({ label: cat.name, value: formatPLN(total), amount: -total }))
}

/** Concessions the investor stops owing — positive amounts, unlike the cost tiles above. A zero one
 *  is dropped: „the company gave up 0 zł" says what no concession at all says. */
function creditFields(credits: [label: string, amount: number][]): FinancialFieldT[] {
  return credits
    .filter(([, amount]) => amount !== 0)
    .map(([label, amount]) => ({ label, value: formatPLN(amount), amount }))
}

type BuildOptionsT = {
  /** Cost tiles only — Robocizna and Wpłaty are the figures under comparison and stay visible at
   *  zero, or the block shrinks to nothing on an empty investment. */
  hideZeroCosts?: boolean
}

/** Category tiles stay on the RAW receipt plane while the listing prices the same labels at what the
 *  investor is billed, so one label carries two numbers across the two surfaces. Deliberate (EX-670,
 *  cancelled): no total drifts, because the whole concession sits in the `MATERIALS_DISCOUNT_LABEL`
 *  tile and the header's bilans is the Σ of these tiles. Moving the tiles onto the billed plane is
 *  only correct together with DROPPING that tile, which would cost the toggle that switches the
 *  concession off — and `FinancialStats` renders only under the legacy `version === 'v1'`. */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
  { hideZeroCosts = false }: BuildOptionsT = {},
): FinancialFieldT[] {
  const {
    categoryCosts,
    totalIncome,
    totalLaborCosts,
    totalDiscount,
    materialsNetDiscount,
    totalLoss,
  } = financials
  const uncategorised = uncategorisedRemainder(financials)

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories, hideZeroCosts),
    ...(uncategorised !== 0
      ? [
          {
            label: CORRECTION_LABEL,
            value: formatPLN(uncategorised),
            amount: -uncategorised,
          },
        ]
      : []),
    {
      label: LABOR_LABEL,
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: INCOME_LABEL, value: formatPLN(totalIncome), amount: totalIncome },
    // The header's bilans is the SUM of these tiles, so every term of `calculateBalance` owes one or
    // the two readings drift apart — the materiały concession and the strata included.
    ...creditFields([
      [DISCOUNT_LABEL, totalDiscount],
      [MATERIALS_DISCOUNT_LABEL, materialsNetDiscount],
      [LOSS_LABEL, totalLoss],
    ]),
  ]
}

/** The same per-category split as `buildSettledFields`, as numeric rows for the summary table. Kept
 *  apart from `buildMaterialsBreakdown` because settled material is never billed to the investor: no
 *  netto bucket, no reduction, and its Σ must NOT join `totalMaterialCosts`. Zero rows dropped. */
export function buildSettledBreakdown(
  settledCategoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): MaterialsBreakdownRowT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(settledCategoryCosts, cat.id) }))
    .filter(({ total }) => total !== 0)
    .map(({ cat, total }) => ({
      id: cat.id,
      label: cat.name,
      net: total,
      origin: 'gross' as const,
    }))
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
