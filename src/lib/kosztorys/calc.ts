import type {
  CostVariantT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysV2RowT,
  SectionSubtotalT,
  ViewPricingT,
} from '@/types/kosztorys'

// VAT: a single rate per investment (vatRate), carried on the row. No section→item cascade.

// The single source of the breakdown formulas. Pure functions — we persist only the
// inputs and compute everything below live. Value is computed from measuredQty (the
// measured qty, "pomiar"), not plannedQty.
//
// Discount ("rabat"): discountValue for 'percent' = percentage points (10 => 10%), for
// 'amount' = an amount in PLN subtracted from the net value.

export function effectiveCostVariant(
  item: KosztorysItemT,
  section: KosztorysSectionT,
): CostVariantT {
  return item.costVariant ?? section.defaultCostVariant
}

function applyDiscount(gross: number, item: KosztorysItemT): number {
  if (item.discountType === 'percent') return gross * (1 - (item.discountValue || 0) / 100)
  if (item.discountType === 'amount') return gross - (item.discountValue || 0)
  return gross
}

/** Net row value at the client price (measured qty × price − discount). */
export function rowNet(item: KosztorysItemT): number {
  return applyDiscount(item.measuredQty * item.clientPrice, item)
}

export function rowGross(item: KosztorysItemT, vatRate: number): number {
  return rowNet(item) * (1 + vatRate)
}

/** Value of a single item stage (qty done × client price − discount). */
export function stageValue(item: KosztorysItemT, qtyDoneInStage: number): number {
  return applyDiscount(qtyDoneInStage * item.clientPrice, item)
}

/** Remaining to do = row net − Σ of completed-stage values. */
export function rowRemaining(item: KosztorysItemT, doneNetTotal: number): number {
  return rowNet(item) - doneNetTotal
}

// --- Price views (one dataset → three views: client / subcontractor with/without tools) ---
export type PriceViewT = 'client' | 'w_tools' | 'own_tools'

/** Effective markup coefficient by view: the section overrides the global (investment) one. */
export function effectiveCoeff(row: ViewPricingT, view: 'w_tools' | 'own_tools'): number {
  if (view === 'w_tools') return row.sectionWToolsCoeff ?? row.globalWToolsCoeff
  return row.sectionOwnToolsCoeff ?? row.globalOwnToolsCoeff
}

/** Subcontractor price by view: null→derived (client×coeff), coeff→client×%, amount→flat. */
export function subcontractorPrice(row: ViewPricingT, view: 'w_tools' | 'own_tools'): number {
  const type = view === 'w_tools' ? row.wToolsOverrideType : row.ownToolsOverrideType
  const value = view === 'w_tools' ? row.wToolsOverrideValue : row.ownToolsOverrideValue
  if (type === 'amount') return value
  if (type === 'coeff') return row.clientPrice * value
  return row.clientPrice * effectiveCoeff(row, view)
}

export function viewPrice(row: ViewPricingT, view: PriceViewT): number {
  if (view === 'w_tools' || view === 'own_tools') return subcontractorPrice(row, view)
  return row.clientPrice
}

/** Row net at the selected view's price (measured qty × view price − discount). */
export function rowNetForView(row: ViewPricingT, view: PriceViewT): number {
  return applyDiscount(row.measuredQty * viewPrice(row, view), row)
}

/** Value of a single stage at the view's price (qty done × view price − discount). */
export function stageValueForView(
  row: ViewPricingT,
  qtyDoneInStage: number,
  view: PriceViewT,
): number {
  return applyDiscount(qtyDoneInStage * viewPrice(row, view), row)
}

/** Remaining by view = view net − Σ of completed-stage values by view. */
export function rowRemainingForView(
  row: ViewPricingT,
  doneNetTotal: number,
  view: PriceViewT,
): number {
  return rowNetForView(row, view) - doneNetTotal
}

/**
 * Net subtotals per section for the active price view. Computed over the full
 * dataset (ignores filter/sort). Order = first occurrence of each section in
 * `rows` (treeToRows already yields section→displayOrder order).
 */
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  view: PriceViewT,
): SectionSubtotalT[] {
  const bySection = new Map<number, SectionSubtotalT>()
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        net: 0,
        share: 0,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
    }
    acc.net += rowNetForView(row, view)
    acc.itemCount += 1
  }
  const result = [...bySection.values()]
  const grandNet = result.reduce((sum, s) => sum + s.net, 0)
  if (grandNet > 0) for (const s of result) s.share = s.net / grandNet
  return result
}
