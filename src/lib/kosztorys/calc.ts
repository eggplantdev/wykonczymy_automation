import type {
  KosztorysItemT,
  KosztorysV2RowT,
  SectionSubtotalT,
  ViewPricingT,
} from '@/types/kosztorys'

// VAT: a single rate per investment (vatRate), carried on the row. No section→item cascade.

// The single source of the breakdown formulas. Pure functions — we persist only the
// inputs and compute everything below live. Settlement values (net, stages, remaining) come from
// measuredQty ("pomiar"); plannedQty ("przedmiar") feeds only rowPlannedNetForView, the offer figure.
//
// Discount ("rabat"): discountValue for 'percent' = percentage points (10 => 10%), for
// 'amount' = an amount in PLN subtracted from the net value.

function applyDiscount(gross: number, item: KosztorysItemT): number {
  if (item.discountType === 'percent') return gross * (1 - (item.discountValue || 0) / 100)
  if (item.discountType === 'amount') return gross - (item.discountValue || 0)
  return gross
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

/**
 * Brutto from any netto figure. VAT applies to the POST-discount net, and one rate covers the whole
 * investment — so this is a render transform, never a stored field. Here rather than inline at each
 * column so a future rounding rule (grosze) is one edit, not six.
 */
export function toGross(net: number, vatRate: number): number {
  return net * (1 + vatRate)
}

/** Row net at the selected view's price (measured qty × view price − discount). */
export function rowNetForView(row: ViewPricingT, view: PriceViewT): number {
  return applyDiscount(row.measuredQty * viewPrice(row, view), row)
}

/**
 * Row value at the PLANNED qty ("wartość przedmiaru") — the offer figure priced straight off the
 * przedmiar, against which rowNetForView is the as-measured, post-discount one.
 *
 * NO discount by design (owner, 2026-07-15): przedmiar is the pre-negotiation valuation, and rabat
 * only enters at settlement. So this is deliberately NOT a mirror of rowNetForView — the gap
 * between the two columns carries both the qty revision and the discount.
 *
 * Not sheet parity: the sheet's column S carries this header but no formula in any row, because
 * there `pomiar` defaults to `=przedmiar`, making the two columns identical until someone overrides
 * pomiar by hand. Our przedmiar/pomiar are independent inputs, so the distinction is real.
 */
export function rowPlannedNetForView(row: ViewPricingT, view: PriceViewT): number {
  return row.plannedQty * viewPrice(row, view)
}

/**
 * Discount actually taken off the row, in PLN at the view's price. Derived rather than read from
 * discountValue, which is only the raw input: under 'percent' it holds percentage points, and under
 * either type it says nothing until it meets a price — which changes per view.
 */
export function rowDiscountForView(row: ViewPricingT, view: PriceViewT): number {
  return row.measuredQty * viewPrice(row, view) - rowNetForView(row, view)
}

/**
 * Value of a single stage at the view's price: the stage's qty SHARE of the row's net.
 *
 * The share is what makes an 'amount' rabat behave — it discounts the whole row (owner,
 * 2026-07-15), so charging the full amount against every stage would subtract it once per stage:
 * an untouched stage rendered negative, and the stage values stopped summing to rowNetForView —
 * the reconciliation the sheet's V–AE block exists to allow. Written as a share of the net, that
 * reconciliation holds by construction rather than by cancellation. 'percent' is unaffected: being
 * multiplicative, its share was always proportional (asserted in kosztorys-calc.test.ts).
 *
 * Not sheet parity — the sheet's V = D*$Q-(D*$Q*$R) is rate-based, so it only ever knew percent.
 * The 'amount' rabat is ours, and this is its rule.
 */
export function stageValueForView(
  row: ViewPricingT,
  qtyDoneInStage: number,
  view: PriceViewT,
): number {
  // No pomiar = no share to take (and nothing to divide by): the stage stands on its own qty.
  if (row.measuredQty === 0) return qtyDoneInStage * viewPrice(row, view)
  return rowNetForView(row, view) * (qtyDoneInStage / row.measuredQty)
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
