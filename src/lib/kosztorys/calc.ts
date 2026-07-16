import type { GlobalDiscountT, ViewPricingT } from '@/types/kosztorys'

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

// Active only when a mode is chosen AND the value is non-zero — a zero-value discount is
// indistinguishable from none, so it must not suppress per-item rabat. The explicit mode check
// fails closed on a persisted value that isn't a known mode (tolerant restore / out-of-band write):
// otherwise the flag would go active while globalDiscountAmount subtracts nothing.
export function isGlobalDiscountActive({ type, value }: GlobalDiscountT): boolean {
  return (type === 'percent' || type === 'amount') && value > 0
}

function applyDiscount(gross: number, item: ViewPricingT): number {
  // Global discount overrides per-item rabat: when it is active the row prices gross-of-its-own
  // discount (the per-item fields stay in the DB, untouched), and the global discount is subtracted
  // once at the total level. Short-circuit BEFORE reading discountType so nothing per-item applies.
  if (item.globalDiscountActive) return gross
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

/**
 * What any quantity of this row is worth at the view's price, post-discount. Zero quantity is worth
 * zero: `> 0` rather than a truthiness check because a cleared cell writes null, and an 'amount' rabat
 * would otherwise turn `applyDiscount(0)` into −discountValue — a row priced at zero reading negative.
 */
export function netForQtyForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  if (!(qty > 0)) return 0
  return applyDiscount(qty * viewPrice(row, view), row)
}

/**
 * Row value at the PLANNED qty ("wartość netto przedmiar") — the OFFER figure, the sheet's
 * S = N×Q − N×Q×R. It prices the przedmiar and carries the rabat, exactly like the settlement figure
 * (v2-rows' rowValueForView) prices the stage sum; the two differ only in which quantity they read.
 *
 * The rabat is IN by construction: this goes through netForQtyForView, so the offer figure has no
 * arithmetic of its own and cannot drift from the sheet by silently dropping the discount.
 *
 * Owner flagged the "rabat in the offer" call as a small open question (2026-07-16, EX-495) — a
 * revert is one commit, so nothing downstream leans on it.
 */
export function rowPlannedNetForView(row: ViewPricingT, view: PriceViewT): number {
  return netForQtyForView(row, row.plannedQty, view)
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
 * How much of the OFFER this stage has delivered, as a fraction (0.75 = 75%) — `null` when there is
 * no denominator to divide by, so render code never divides and never fakes a 0%.
 *
 * The denominator is the przedmiar, not the stage sum. Against the stage sum the stages' percentages
 * would always add up to 100% — they would say "what share of the work fell to this stage" instead
 * of "how much of the offer this stage delivered", and the row's own percentage would read 100%
 * everywhere, being a number divided by itself.
 *
 * View-independent because it is a ratio of QUANTITIES — nothing here reads a price, so no view and
 * no rabat can move it, and the one figure the grid shows means the same thing in all of them.
 *
 * Deliberately unclamped: stages routinely overshoot the przedmiar, and a >100% reading is the row
 * saying so. The grid pairs it with a red cell (hasStagesOverPlanned); clamping would erase both.
 */
export function stageDoneFraction(row: ViewPricingT, qtyDoneInStage: number): number | null {
  return doneFraction(row, qtyDoneInStage)
}

/** The row's overall completion, same shape and same reasoning as stageDoneFraction. */
export function rowDoneFraction(row: ViewPricingT, totalQtyDone: number): number | null {
  return doneFraction(row, totalQtyDone)
}

/**
 * The guard is `> 0`, not `=== 0`: clearing the Przedmiar cell writes `null` (the grid's float
 * column is `Column<number|null>`), which a strict-equality check walks straight past into
 * `qty / null` — NaN or Infinity rendered verbatim in the cell. Also covers `undefined` and a
 * negative przedmiar.
 */
function doneFraction(row: ViewPricingT, qtyDone: number): number | null {
  if (!(row.plannedQty > 0)) return null
  return qtyDone / row.plannedQty
}

/**
 * The global (whole-kosztorys) discount in PLN off the executed total. 'percent' scales the total,
 * 'amount' is flat, none/zero is 0. Not distributed onto rows or stages — subtracted once here so
 * `do zapłaty = totalNet − globalDiscountAmount(totalNet, discount)`. Not clamped below zero; a
 * discount larger than the total is bad input to surface, not to silently floor.
 */
export function globalDiscountAmount(totalNet: number, discount: GlobalDiscountT): number {
  if (discount.type === 'percent') return (totalNet * discount.value) / 100
  if (discount.type === 'amount') return discount.value
  return 0
}
