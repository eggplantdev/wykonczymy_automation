import { subcontractorPrice } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/**
 * The company's floor on its own cut: a subcontractor may be paid at most this share of the client
 * price. A code constant rather than a per-investment column — it is a business rule, not a
 * negotiated parameter, and one the owner never wants a per-sheet exception to.
 */
export const MAX_CLIENT_SHARE = 0.65

// Half a grosz. The comparison is strictly-greater, so without slack a price typed at exactly the
// ceiling (that figure rounded to two decimals and entered by hand) reads as "above" on a
// floating-point remainder and is refused for no reason the owner can see.
const TOLERANCE = 0.005

/**
 * The ceiling in PLN — named by the rejection message, so it must come from the same constant.
 *
 * Measured against the LIST price, before any rabat (owner, 2026-07-28). The rabat is the company
 * giving away part of its own cut, so letting it drag the ceiling down would make a discount
 * retroactively re-price the subcontractor — who never agreed to fund it. `clientPrice` is already
 * the pre-rabat unit price (`applyDiscount` works on the row's gross value, not on this), so the
 * multiplication below needs nothing extra; what it needs is to stay that way.
 */
export function maxSubcontractorPrice(row: ViewPricingT): number {
  return row.clientPrice * MAX_CLIENT_SHARE
}

/**
 * The one rule: why this row's subcontractor price is refused on this plane, or `null` if it stands.
 *
 * One verdict, not a severity ladder. There used to be an amber tier for a price above the
 * investment's global multiplier, and it was simply too talkative to read: typing a flat price above
 * the multiplier is ordinary, so the tier lit up across rows that were all perfectly fine and the
 * colour stopped meaning anything (owner, 2026-07-28). What is left is the rule that actually
 * refuses a write.
 *
 * Reads `subcontractorPrice` rather than re-deriving it, so the guard can never disagree with the
 * price the grid shows. Carries its own Polish message — no consumer composes a sentence, so the
 * tooltip and the cell cannot word the same verdict differently.
 */
export function checkSubcontractorPrice(row: ViewPricingT, view: ToolPlaneT): string | null {
  const price = subcontractorPrice(row, view)
  // The floor holds whatever the client price is: nothing legitimate pays a subcontractor a negative
  // figure, and it would subtract from every total it reaches.
  if (price < 0) return 'Cena wykonawcy nie może być ujemna.'

  // The ceiling is a share of the client price; at zero it collapses to zero and every non-zero
  // subcontractor price would read as an error on a row nobody has priced yet.
  if (!(row.clientPrice > 0)) return null

  const ceiling = maxSubcontractorPrice(row)
  if (price > ceiling + TOLERANCE) {
    return `Cena wykonawcy nie może przekroczyć ${MAX_CLIENT_SHARE * 100}% ceny dla inwestora (maks. ${formatNet(ceiling)}).`
  }

  return null
}
