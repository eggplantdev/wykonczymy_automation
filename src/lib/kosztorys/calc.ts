import { OVERRIDE_COEFF_FIELDS, OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { round6 } from '@/lib/utils/round'
import type {
  GlobalDiscountT,
  KosztorysGlobalCoeffsT,
  KosztorysItemT,
  PriceSourceT,
  ToolPlaneT,
  ViewPricingT,
} from '@/lib/kosztorys/types'

export const MONEY_TOLERANCE = 0.005

// Discount ("rabat"): discountValue for 'percent' = percentage points (10 => 10%), for
// 'amount' = an amount in PLN subtracted from the net value.

export function isGlobalDiscountActive({ type }: GlobalDiscountT): boolean {
  return type === 'amount'
}

export function globalDiscountForMode(
  mode: 'off' | 'amount' | 'percent',
  perItemDiscountTotal: number,
): GlobalDiscountT {
  return mode === 'amount'
    ? { type: 'amount', value: perItemDiscountTotal }
    : { type: null, value: 0 }
}

function applyDiscount(gross: number, item: ViewPricingT): number {
  if (item.globalDiscountActive) return gross
  if (item.discountType === 'percent') return gross * (1 - (item.discountValue || 0) / 100)
  if (item.discountType === 'amount') return gross - (item.discountValue || 0)
  return gross
}

export type PriceViewT = 'client' | ToolPlaneT

export function effectiveCoeff(row: ViewPricingT, view: ToolPlaneT): number {
  return view === 'w_tools' ? row.globalWToolsCoeff : row.globalOwnToolsCoeff
}

export function overrideValueFor(
  row: Pick<ViewPricingT, 'wToolsOverrideValue' | 'ownToolsOverrideValue'>,
  view: ToolPlaneT,
): number | null {
  return row[OVERRIDE_FIELDS[view]]
}

export function overrideCoeffFor(
  row: Pick<ViewPricingT, 'wToolsOverrideCoeff' | 'ownToolsOverrideCoeff'>,
  view: ToolPlaneT,
): number | null {
  return row[OVERRIDE_COEFF_FIELDS[view]]
}

/**
 * `!== null` asks „is it the absence I expect", so a payload one key short (`undefined`) or a broken
 * import (`NaN`) walks through claiming to be a deliberate mnożnik.
 */
export const namesFigure = (value: number | null): value is number => Number.isFinite(value)

export function priceSourceOf(
  row: Pick<
    ViewPricingT,
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'wToolsOverrideCoeff'
    | 'ownToolsOverrideCoeff'
  >,
  view: ToolPlaneT,
): PriceSourceT {
  if (namesFigure(overrideCoeffFor(row, view))) return 'coeff'
  if (namesFigure(overrideValueFor(row, view))) return 'amount'
  return 'auto'
}

export function asViewPricing(
  item: KosztorysItemT,
  coeffs: KosztorysGlobalCoeffsT = { wTools: 0, ownTools: 0 },
): ViewPricingT {
  return {
    ...item,
    globalDiscountActive: false,
    globalWToolsCoeff: coeffs.wTools,
    globalOwnToolsCoeff: coeffs.ownTools,
  }
}

export function shownCoeff(row: ViewPricingT, view: ToolPlaneT): number | null {
  switch (priceSourceOf(row, view)) {
    case 'coeff':
      return overrideCoeffFor(row, view)
    case 'auto':
      return effectiveCoeff(row, view)
    default:
      return null
  }
}

export function subcontractorPrice(row: ViewPricingT, view: ToolPlaneT): number {
  switch (priceSourceOf(row, view)) {
    case 'coeff':
      return row.clientPrice * overrideCoeffFor(row, view)!
    case 'amount':
      return overrideValueFor(row, view)!
    default:
      return row.clientPrice * effectiveCoeff(row, view)
  }
}

export function viewPrice(row: ViewPricingT, view: PriceViewT): number {
  if (view === 'w_tools' || view === 'own_tools') return subcontractorPrice(row, view)
  return row.clientPrice
}

export function toGross(net: number, vatRate: number): number {
  return net * (1 + vatRate)
}

/**
 * Divides rather than `× (1 − rate)`: at 23% a 123 zł brutto is 100 zł netto, and 123 × 0,77 = 94,71
 * is a different figure.
 */
export function toNet(gross: number, vatRate: number): number {
  return gross / (1 + vatRate)
}

/**
 * Six places, not grosze: a grosz-rounded netto can re-gross a grosz off the brutto that was typed
 * (0,07 zł at 8% reads back as 0,06).
 */
export function discountNetFromGross(gross: number, vatRate: number): number {
  return round6(toNet(gross, vatRate))
}

/**
 * Zero quantity is worth zero: an 'amount' rabat would otherwise turn `applyDiscount(0)` into
 * −discountValue — a row priced at zero reading negative.
 *
 * Rabat is a CLIENT concession, absorbed by the company margin and never passed to the subcontractor.
 */
export function netForQtyForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  if (!(qty > 0)) return 0
  const gross = qty * viewPrice(row, view)
  return view === 'client' ? applyDiscount(gross, row) : gross
}

export function resolvedCurrentPlannedQty(
  row: Pick<KosztorysItemT, 'plannedQty' | 'currentPlannedQty'>,
): number {
  return row.currentPlannedQty ?? row.plannedQty
}

export function rowPlannedNetForView(row: ViewPricingT, view: PriceViewT): number {
  return netForQtyForView(row, row.plannedQty, view)
}

export function rowCurrentPlannedNetForView(row: ViewPricingT, view: PriceViewT): number {
  return netForQtyForView(row, resolvedCurrentPlannedQty(row), view)
}

/**
 * Routing the forecast through the offer figure would discount only its client half — the rabat never
 * reaches a subcontractor plane — and inflate the forecast margin by the whole rabat.
 */
export function rowPlannedNetPreDiscountForView(row: ViewPricingT, view: PriceViewT): number {
  return row.plannedQty > 0 ? row.plannedQty * viewPrice(row, view) : 0
}

export function rowDiscountForView(row: ViewPricingT, qty: number, view: PriceViewT): number {
  return qty * viewPrice(row, view) - netForQtyForView(row, qty, view)
}

/**
 * The share is what makes an 'amount' rabat behave — it discounts the whole row, so charging the full
 * amount against every stage would subtract it once per stage.
 */
export function stageValueForView(
  row: ViewPricingT,
  qtyDoneInStage: number,
  totalQty: number,
  view: PriceViewT,
): number {
  // `> 0` rather than `=== 0`: a cleared cell writes null, which strict equality walks past into a divide.
  if (!(totalQty > 0)) return 0
  return netForQtyForView(row, totalQty, view) * (qtyDoneInStage / totalQty)
}

/**
 * Deliberately unclamped: stages routinely overshoot the przedmiar, and a >100% reading is the row
 * saying so.
 */
export function rowDoneFraction(row: ViewPricingT, totalQtyDone: number): number | null {
  return doneFraction(totalQtyDone, resolvedCurrentPlannedQty(row))
}

export function rowOfferDoneFraction(
  row: Pick<KosztorysItemT, 'plannedQty'>,
  totalQtyDone: number,
): number | null {
  return doneFraction(totalQtyDone, row.plannedQty)
}

function doneFraction(totalQtyDone: number, plannedQty: number): number | null {
  if (!(plannedQty > 0)) return null
  return totalQtyDone / plannedQty
}

export function globalDiscountAmount(totalNet: number, discount: GlobalDiscountT): number {
  if (discount.type === 'amount') return discount.value
  return 0
}
