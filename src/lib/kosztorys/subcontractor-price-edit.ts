import { overrideValueFor, subcontractorPrice } from '@/lib/kosztorys/calc'
import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { formatPLN } from '@/lib/utils/format-currency'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/** `null` IS the write that means „auto" (EX-766). */
function withOverride<RowT extends ViewPricingT>(
  rowData: RowT,
  view: ToolPlaneT,
  value: number | null,
): RowT {
  return { ...rowData, [OVERRIDE_FIELDS[view]]: value }
}

/**
 * „Cena j.m." of a subcontractor view. A typed number IS „kwota stała" — the keystroke carries the
 * źródło with it, so nobody has to visit „Źródło" first — and clearing the cell is the way back to
 * „auto".
 *
 * The only cell family whose `clear` writes `null` rather than 0: everywhere else an emptied field
 * means „nothing", here it means „ask the investment". A `0` would be a stawka of zero złotych.
 *
 * The only cell family that carries a `guard`: the ceiling is a rule about what the company may pay
 * a crew, and it has no business on the client's own price.
 */
export function subcontractorPolicy<RowT extends ViewPricingT>(
  view: ToolPlaneT,
): CellEditPolicyT<RowT, number | null> {
  return {
    snapshot: (row) => overrideValueFor(row, view),
    sameEntry: (a, b) => a === b,
    restore: (row, entry) => withOverride(row, view, entry),
    applyValue: (row, value) => withOverride(row, view, value),
    clear: (row) => withOverride(row, view, null),
    guard: (row) => checkSubcontractorPrice(row, view),
    restoredLabel: (row) => formatPLN(subcontractorPrice(row, view)),
  }
}

/**
 * Switching „Źródło".
 *
 * „kwota stała" is seeded with the price the row already SHOWS, so the switch is what it claims to be
 * — a change of source, not of price. It can still turn the cell red without moving a liczba: the
 * ceiling judges a kwota stała only, so a row sitting at 90% in „auto" is silent until the switch
 * makes the same number the row's own. That is the verdict arriving, not the price changing — the
 * mnożnik was over the sufit all along and said so in its own field. „auto" means „whatever the
 * investment says", so it drops the row's own number and the price follows the global mnożnik.
 */
export function modeChange<RowT extends ViewPricingT>(
  rowData: RowT,
  fixed: boolean,
  view: ToolPlaneT,
): RowT {
  return withOverride(rowData, view, fixed ? subcontractorPrice(rowData, view) : null)
}
