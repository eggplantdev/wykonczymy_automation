import { asViewPricing, priceSourceOf, subcontractorPrice } from '@/lib/kosztorys/calc'
import { DEFAULT_COEFFS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { CellVerdictT } from '@/lib/kosztorys/cell-edit'
import { formatCoeff, formatNet } from '@/lib/kosztorys/format'
import type { KosztorysItemT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/**
 * The company's floor on its own cut: a crew may be paid at most this share of the client price. A
 * code constant rather than a per-investment column — it is a business rule, not a negotiated
 * parameter, and one the owner never wants a per-sheet exception to.
 *
 * One figure per plane, because the standard deal itself differs by plane: the stawka bez narzędzi
 * IS the z-narzędziami one less 15% (`=R−R*0,15` in the owner's sheet), so a flat 65% there sat ten
 * points above every rate anyone ever agreed and flagged nothing (owner, 2026-09-28). The ceiling is
 * therefore the standard rate — pay more than the deal and you are eating the marża — which is why
 * it reads `DEFAULT_COEFFS` rather than restating the same two liczby.
 */
export const MAX_CLIENT_SHARE: Record<ToolPlaneT, number> = {
  w_tools: DEFAULT_COEFFS.wTools,
  own_tools: DEFAULT_COEFFS.ownTools,
}

// Every screen that names the ceiling reads it from here, because the ten call sites had drifted into
// three different liczby for one rule: „55%" on the filter labels, „0,553" in the settings tooltip
// (above the limit it described) and the raw mnożnik in the warning beside it.
//
// Neither shared percent formatter fits a THRESHOLD: at zero decimals the bez-narzędzi ceiling printed
// „55%", a limit the cells do not enforce, and at one it rounds UP to „55,3%", promising more than they
// allow. So it formats here, to the place the rule actually holds.
export const clientShareCeilingLabel = (plane: ToolPlaneT): string =>
  `${(MAX_CLIENT_SHARE[plane] * 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`

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
export function maxSubcontractorPrice(
  row: Pick<ViewPricingT, 'clientPrice'>,
  plane: ToolPlaneT,
): number {
  return row.clientPrice * MAX_CLIENT_SHARE[plane]
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
  plane: ToolPlaneT,
): boolean {
  if (price === null || !(row.clientPrice > 0)) return false
  return price > maxSubcontractorPrice(row, plane) + TOLERANCE
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
 * rung reads a stawka the wiersz itself authored only, zero stopped being reported by „bez ceny wykonawcy" for the same
 * reason, and a negative one IS still refused per pozycja — which is the problem, because that is
 * one verdict repeated across the whole rozpiska while the field that caused it stays unmarked.
 */
export const isCoeffFlagged = (coeff: number, plane: ToolPlaneT): boolean =>
  coeff > MAX_CLIENT_SHARE[plane] || coeff <= 0

/**
 * Its own sentence rather than the row one: a stawka over the ceiling is one pozycja, a mnożnik over
 * it is every pozycja still on „auto". Three sentences for three different mistakes — one overpays
 * the crew, one stops paying it, one makes it pay us.
 */
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

/**
 * The ceiling question as a predicate, so the red cell and the „z własną stawką ponad …% ceny"
 * filters read one rule instead of two copies that can be edited apart — including the half-grosz
 * tolerance, without which a kwota typed back off the screen lands on opposite sides of the two
 * readings.
 *
 * „Własna" means the author of the figure sits in THIS wiersz — a kwota stała or a mnożnik alike,
 * because overpaying is the same overpayment whichever of the two produced it (EX-865). Only „auto"
 * is exempt, and there the author is the investment's own współczynnik, judged once in its own field
 * (`coeffWarning`) instead of once per pozycja. So the filters' negated twin („bez własnej stawki
 * ponad …% ceny") holds every „auto" pozycja as well — a complement of this predicate, not of
 * „pozycje z własną stawką". The registry states that out loud beside the pair; do not narrow it here
 * without moving that ruling too.
 */
export const isOwnRateOverCeiling = (row: ViewPricingT, view: ToolPlaneT): boolean =>
  priceSourceOf(row, view) !== 'auto' && isOverCeiling(subcontractorPrice(row, view), row, view)

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
 * impossible one — a crew genuinely does cost more than its plane's standard share sometimes, and a
 * kosztorys that cannot record it is a kosztorys that lies (owner, 2026-09-20). So it warns: the
 * write lands, the cell goes red and the „Problemy" filter picks the row up.
 *
 * Never flag against the investment's global mnożnik instead: a price above it is ordinary, so that
 * threshold lit up across rows that were all fine and the colour stopped meaning anything
 * (owner, 2026-07-28). The ceiling is rare, which is what keeps the red worth looking at.
 *
 * The ceiling therefore judges a stawka this wiersz authored — kwota stała or własny mnożnik. On
 * „auto" the author of the figure is the investment's mnożnik, which carries its own red field and
 * its own sentence (`coeffWarning`) — judging its output row by row is the same verdict repeated a
 * thousand times, and since the hard cap came off the mnożnik (2026-09-21) one keystroke was enough
 * to throw a whole rozpiska over.
 *
 * Asks both questions through the two predicates above rather than re-deriving them, so the cell that
 * refuses a write, the red colour and the „Problemy" rows can never disagree. Carries its own Polish
 * message — no consumer composes a sentence, so the tooltip and the toast cannot word the same verdict
 * differently.
 */
export function checkSubcontractorPrice(row: ViewPricingT, view: ToolPlaneT): CellVerdictT | null {
  // The floor holds whatever the client price is: nothing legitimate pays a subcontractor a negative
  // figure, and it would subtract from every total it reaches.
  if (isSubcontractorPriceNegative(row, view)) {
    return { severity: 'refuse', message: 'Cena wykonawcy nie może być ujemna.' }
  }

  if (!isOwnRateOverCeiling(row, view)) return null

  return {
    severity: 'warn',
    message: `Cena wykonawcy przekracza ${clientShareCeilingLabel(view)} ceny dla inwestora (maks. ${formatNet(maxSubcontractorPrice(row, view))}).`,
  }
}

// The ceiling WARNS and does not block: a price the owner entered on purpose must not be refused by
// the row it lands in, but he still gets told which praca crossed it.
//
// `asViewPricing` supplies zero globals, which is inert here: the guard judges a stawka this wiersz
// authored, and neither of those two źródła reads a global — a kwota is frozen, a mnożnik prices off
// the cena j.m. So it needs no investment context to reach its verdict.
//
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
