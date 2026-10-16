import { asViewPricing, priceSourceOf, subcontractorPrice } from '@/lib/kosztorys/calc'
import { DEFAULT_COEFFS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { CellVerdictT } from '@/lib/kosztorys/cell-edit'
import { formatCoeff, formatNet } from '@/lib/kosztorys/format'
import type { KosztorysItemT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// The ceiling is the standard rate — pay more than the deal and you are eating the marża.
export const MAX_CLIENT_SHARE: Record<ToolPlaneT, number> = {
  w_tools: DEFAULT_COEFFS.wTools,
  own_tools: DEFAULT_COEFFS.ownTools,
}

// Neither shared percent formatter fits a THRESHOLD: at zero decimals the bez-narzędzi ceiling printed
// „55%", a limit the cells do not enforce, and at one it rounds UP to „55,3%", promising more than they
// allow.
export const clientShareCeilingLabel = (plane: ToolPlaneT): string =>
  `${(MAX_CLIENT_SHARE[plane] * 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`

// The comparison is strictly-greater, so without slack a price typed at exactly the
// ceiling (that figure rounded to two decimals and entered by hand) reads as "above" on a
// floating-point remainder and is flagged for no reason the owner can see.
const TOLERANCE = 0.005

/**
 * The rabat is the company giving away part of its own cut, so letting it drag the ceiling down would
 * make a discount retroactively re-price the subcontractor — who never agreed to fund it.
 */
export function maxSubcontractorPrice(
  row: Pick<ViewPricingT, 'clientPrice'>,
  plane: ToolPlaneT,
): number {
  return row.clientPrice * MAX_CLIENT_SHARE[plane]
}

export function isOverCeiling(
  price: number | null,
  row: Pick<ViewPricingT, 'clientPrice'>,
  plane: ToolPlaneT,
): boolean {
  if (price === null || !(row.clientPrice > 0)) return false
  return price > maxSubcontractorPrice(row, plane) + TOLERANCE
}

/**
 * No tolerance, unlike `isOverCeiling`: the float remainder that one allows for is created by the
 * `clientPrice × 0.65` multiplication, and „0,65" typed by hand parses to the same double as the
 * constant.
 */
export const isCoeffFlagged = (coeff: number, plane: ToolPlaneT): boolean =>
  coeff > MAX_CLIENT_SHARE[plane] || coeff <= 0

export function coeffWarning(coeff: number, plane: ToolPlaneT): string | null {
  if (coeff < 0) {
    return 'Mnożnik ujemny daje wykonawcy stawkę poniżej zera na każdej pozycji ze źródłem „auto" — apka odmówi zapisu takiej ceny.'
  }
  if (coeff === 0) {
    return 'Mnożnik 0 daje wykonawcy 0 zł na każdej pozycji ze źródłem „auto".'
  }
  if (!isCoeffFlagged(coeff, plane)) return null
  return `Mnożnik ${formatCoeff(coeff)} przekracza ${clientShareCeilingLabel(plane)} ceny dla inwestora — wykonawca zjada marżę na pozycjach ze źródłem „auto".`
}

export const isOwnRateOverCeiling = (row: ViewPricingT, view: ToolPlaneT): boolean =>
  priceSourceOf(row, view) !== 'auto' && isOverCeiling(subcontractorPrice(row, view), row, view)

export const isSubcontractorPriceNegative = (row: ViewPricingT, view: ToolPlaneT): boolean =>
  subcontractorPrice(row, view) < 0

/**
 * Never flag against the investment's global mnożnik instead: a price above it is ordinary, so that
 * threshold lit up across rows that were all fine and the colour stopped meaning anything
 * (owner, 2026-07-28).
 */
export function checkSubcontractorPrice(row: ViewPricingT, view: ToolPlaneT): CellVerdictT | null {
  if (isSubcontractorPriceNegative(row, view)) {
    return { severity: 'refuse', message: 'Cena wykonawcy nie może być ujemna.' }
  }

  if (!isOwnRateOverCeiling(row, view)) return null

  return {
    severity: 'warn',
    message: `Cena wykonawcy przekracza ${clientShareCeilingLabel(view)} ceny dla inwestora (maks. ${formatNet(maxSubcontractorPrice(row, view))}).`,
  }
}

// A Set per praca because the negative-price sentence does not name the płaszczyzna: both below zero
// would otherwise toast the same line twice.
export const ceilingWarnings = (items: readonly KosztorysItemT[]): string[] =>
  items.flatMap((item) => {
    const pricing = asViewPricing(item)
    const problems = new Set(
      TOOL_PLANES.flatMap((plane) => checkSubcontractorPrice(pricing, plane)?.message ?? []),
    )
    return [...problems].map((problem) => `„${item.description}": ${problem}`)
  })
