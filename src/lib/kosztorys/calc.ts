import type { KosztorysItemT, ViewPricingT } from '@/types/kosztorys'

// VAT: a single rate per investment (vatRate), carried on the row. No section→item cascade.

// The pricing layer: what a row is worth per unit, and what ANY quantity of it is worth at that
// price. Pure functions over ViewPricingT — we persist only the inputs and compute everything live.
//
// Structurally stage-blind, on purpose. Which quantity is the truth is a settlement question (the
// stages answer it), so it is decided one layer up in v2-rows.ts, which knows stages and imports
// this. Here every figure takes its quantity as a PARAMETER — nothing in this file reads a qty off
// the row except rowPlannedNetForView, the offer figure, whose quantity is the przedmiar by
// definition.
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

/** What any quantity of this row is worth at the view's price, post-discount. */
export function netForQtyForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  return applyDiscount(qty * viewPrice(row, view), row)
}

/**
 * Row value at the PLANNED qty ("wartość przedmiaru") — the offer figure priced straight off the
 * przedmiar, against which the settlement figure (v2-rows' rowValueForView) is what was executed.
 *
 * NO discount by design (owner, 2026-07-15): przedmiar is the pre-negotiation valuation, and rabat
 * only enters at settlement. So this is deliberately NOT netForQtyForView at the przedmiar — the gap
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
export function rowDiscountForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  return qty * viewPrice(row, view) - netForQtyForView(row, qty, view)
}

/**
 * Value of a single stage at the view's price: the stage's qty SHARE of what the whole stage sum
 * (`totalQty`, handed in by the settlement layer) is worth.
 *
 * The share is what makes an 'amount' rabat behave — it discounts the whole row (owner,
 * 2026-07-15), so charging the full amount against every stage would subtract it once per stage:
 * an untouched stage rendered negative, and the stage values stopped summing to the row's value —
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
  totalQty: number,
  view: PriceViewT,
): number {
  // A zero sum means every stage in it is zero, this one included — so 0 is the stage's actual
  // value, not a fallback. `> 0` rather than `=== 0`: a cleared cell writes null, which strict
  // equality walks past into a divide.
  if (!(totalQty > 0)) return 0
  return netForQtyForView(row, totalQty, view) * (qtyDoneInStage / totalQty)
}

/**
 * How far along a stage is, as a fraction (0.75 = 75%) — `null` when there is no denominator to
 * divide by, so render code never divides and never fakes a 0%.
 *
 * View-independent by construction: stageValueForView takes the stage's qty SHARE of the row net,
 * so stageValue/rowNet reduces to qtyDone/measuredQty — the price and the rabat cancel out, and the
 * percentage is the same figure under every price view and under netto or brutto alike.
 *
 * Deliberately unclamped: pomiar and stages disagree routinely (EX-489), so a >100% reading is not
 * an error to hide but the row saying its two numbers don't line up. The grid pairs it with a red
 * cell (hasMeasurementMismatch); clamping here would erase both signals.
 */
export function stageDoneFraction(row: ViewPricingT, qtyDoneInStage: number): number | null {
  return doneFraction(row, qtyDoneInStage)
}

/** The row's overall completion, same shape and same reasoning as stageDoneFraction. */
export function rowDoneFraction(row: ViewPricingT, totalQtyDone: number): number | null {
  return doneFraction(row, totalQtyDone)
}

/**
 * The guard is `> 0`, not `=== 0`: clearing the Pomiar cell writes `null` (the grid's float column
 * is `Column<number|null>`), which a strict-equality check walks straight past into `qty / null` —
 * NaN or Infinity rendered verbatim in the cell. This also covers `undefined` and a negative pomiar.
 */
function doneFraction(row: ViewPricingT, qtyDone: number): number | null {
  if (!(row.measuredQty > 0)) return null
  return qtyDone / row.measuredQty
}
