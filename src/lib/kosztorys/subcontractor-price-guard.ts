import { overrideValueFor, subcontractorPrice } from '@/lib/kosztorys/calc'
import type { CellVerdictT } from '@/lib/kosztorys/cell-edit'
import { formatCoeff, formatNet, formatPercent } from '@/lib/kosztorys/format'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/**
 * The company's floor on its own cut: a subcontractor may be paid at most this share of the client
 * price. A code constant rather than a per-investment column — it is a business rule, not a
 * negotiated parameter, and one the owner never wants a per-sheet exception to.
 */
export const MAX_CLIENT_SHARE = 0.65

// Half a grosz. The comparison is strictly-greater, so without slack a price typed at exactly the
// ceiling (that figure rounded to two decimals and entered by hand) reads as "above" on a
// floating-point remainder and is flagged for no reason the owner can see.
const TOLERANCE = 0.005

/**
 * Measured against the LIST price, before any rabat (owner, 2026-07-28). The rabat is the company
 * giving away part of its own cut, so letting it drag the ceiling down would make a discount
 * retroactively re-price the subcontractor — who never agreed to fund it. `clientPrice` is already
 * the pre-rabat unit price (`applyDiscount` works on the row's gross value, not on this), so the
 * multiplication below needs nothing extra; what it needs is to stay that way.
 */
export function maxSubcontractorPrice(row: Pick<ViewPricingT, 'clientPrice'>): number {
  return row.clientPrice * MAX_CLIENT_SHARE
}

/**
 * The ceiling as a yes/no on a bare stawka, for a surface that holds no full row — the katalog table,
 * which renders a SHARE and would otherwise compare `rate / clientPrice > 0.65` on its own. That form
 * carries no tolerance, so cena 100,01 zł against stawka 65,01 zł came out red there and clean in the
 * rozpiska.
 *
 * At a client price of zero the ceiling collapses to zero, and every non-zero stawka would read as an
 * error on a row nobody has priced yet — so there is nothing to measure and nothing to say.
 */
export function isOverCeiling(
  price: number | null,
  row: Pick<ViewPricingT, 'clientPrice'>,
): boolean {
  if (price === null || !(row.clientPrice > 0)) return false
  return price > maxSubcontractorPrice(row) + TOLERANCE
}

/**
 * No tolerance, unlike `isOverCeiling`: the float remainder that one allows for is created by the
 * `clientPrice × 0.65` multiplication, and „0,65" typed by hand parses to the same double as the
 * constant.
 *
 * Judged, never refused — the one lever that re-prices a whole kosztorys must not be the only surface
 * that will not say why (owner, 2026-09-21).
 *
 * Everything outside (0, 0.65], because each of those ends produces a stawka nobody would type by
 * hand on a single pozycja, and none of them is answered here by the row-level guard: the ceiling
 * rung reads a kwota stała only, zero stopped being reported by „bez ceny wykonawcy" for the same
 * reason, and a negative one IS still refused per pozycja — which is the problem, because that is
 * one verdict repeated across the whole rozpiska while the field that caused it stays unmarked.
 */
export const isCoeffFlagged = (coeff: number): boolean => coeff > MAX_CLIENT_SHARE || coeff <= 0

/**
 * Its own sentence rather than the row one: a stawka over the ceiling is one pozycja, a mnożnik over
 * it is every pozycja still on „auto". Three sentences for three different mistakes — one overpays
 * the crew, one stops paying it, one makes it pay us.
 */
export function coeffWarning(coeff: number): string | null {
  if (coeff < 0) {
    return 'Mnożnik ujemny daje wykonawcy stawkę poniżej zera na każdej pozycji ze źródłem „auto" — apka odmówi zapisu takiej ceny.'
  }
  if (coeff === 0) {
    return 'Mnożnik 0 daje wykonawcy 0 zł na każdej pozycji ze źródłem „auto".'
  }
  if (!isCoeffFlagged(coeff)) return null
  return `Mnożnik ${formatCoeff(coeff)} przekracza ${formatPercent(MAX_CLIENT_SHARE)} ceny dla inwestora — wykonawca zjada marżę na pozycjach ze źródłem „auto".`
}

/**
 * The ceiling question as a predicate, so the red cell and the „z kwotą stałą powyżej sufitu"
 * filters read one rule instead of two copies that can be edited apart — including the half-grosz
 * tolerance, without which a kwota typed back off the screen lands on opposite sides of the two
 * readings. A source of „auto" is not over anything: `isOverCeiling` short-circuits on the null,
 * which is also what makes the filters' negated twin an exact complement rather than a second,
 * narrower question.
 */
export const isFixedRateOverCeiling = (row: ViewPricingT, view: ToolPlaneT): boolean =>
  isOverCeiling(overrideValueFor(row, view), row)

/**
 * Unlike the ceiling, this one reads the PRICE rather than the nadpisanie, so it catches an „auto"
 * row whose mnożnik went below zero as readily as a typed one. Shared with the „Problemy" list for
 * the same reason as its neighbour: the cell that refuses the write and the row the list picks up
 * must be the same rows.
 */
export const isSubcontractorPriceNegative = (row: ViewPricingT, view: ToolPlaneT): boolean =>
  subcontractorPrice(row, view) < 0

/**
 * Two tiers, and the difference is whether the figure can be REAL. A negative stawka is arithmetic
 * nobody ever meant, so it is refused outright. A stawka above the ceiling is a bad deal, not an
 * impossible one — a crew genuinely does cost more than 65% of the client price sometimes, and a
 * kosztorys that cannot record it is a kosztorys that lies (owner, 2026-09-20). So it warns: the
 * write lands, the cell goes red and the „Problemy" filter picks the row up.
 *
 * Never flag against the investment's global mnożnik instead: a price above it is ordinary, so that
 * threshold lit up across rows that were all fine and the colour stopped meaning anything
 * (owner, 2026-07-28). The ceiling is rare, which is what keeps the red worth looking at.
 *
 * The ceiling therefore judges a kwota stała only. On „auto" the author of the figure is the
 * investment's mnożnik, which carries its own red field and its own sentence (`coeffWarning`) —
 * judging its output row by row is the same verdict repeated a thousand times, and since the hard cap
 * came off the mnożnik (2026-09-21) one keystroke was enough to throw a whole rozpiska over.
 *
 * Reads `subcontractorPrice` rather than re-deriving it, so the guard can never disagree with the
 * price the grid shows. Carries its own Polish message — no consumer composes a sentence, so the
 * tooltip and the toast cannot word the same verdict differently.
 */
export function checkSubcontractorPrice(row: ViewPricingT, view: ToolPlaneT): CellVerdictT | null {
  const price = subcontractorPrice(row, view)
  // The floor holds whatever the client price is: nothing legitimate pays a subcontractor a negative
  // figure, and it would subtract from every total it reaches.
  if (price < 0) {
    return { severity: 'refuse', message: 'Cena wykonawcy nie może być ujemna.' }
  }

  if (overrideValueFor(row, view) === null) return null

  if (!isOverCeiling(price, row)) return null

  return {
    severity: 'warn',
    message: `Cena wykonawcy przekracza ${formatPercent(MAX_CLIENT_SHARE)} ceny dla inwestora (maks. ${formatNet(maxSubcontractorPrice(row))}).`,
  }
}
