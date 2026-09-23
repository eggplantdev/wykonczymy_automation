import {
  effectiveCoeff,
  overrideCoeffFor,
  overrideValueFor,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { OVERRIDE_COEFF_FIELDS, OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { formatPLN } from '@/lib/utils/format-currency'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/**
 * Write one source and silence the other — the optimistic mirror of `normalizeOverridePatch`, which
 * does the same to the patch that reaches the DB. Without the mirror the row on screen and the row in
 * the base disagree for exactly one refresh, and what the user sees during it is the stawka they just
 * replaced.
 *
 * `null` in both IS the write that means „auto" (EX-766).
 */
function withSource<RowT extends ViewPricingT>(
  rowData: RowT,
  view: ToolPlaneT,
  value: number | null,
  coeff: number | null,
): RowT {
  return { ...rowData, [OVERRIDE_FIELDS[view]]: value, [OVERRIDE_COEFF_FIELDS[view]]: coeff }
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
    restore: (row, entry) => withSource(row, view, entry, null),
    applyValue: (row, value) => withSource(row, view, value, null),
    clear: (row) => withSource(row, view, null, null),
    guard: (row) => checkSubcontractorPrice(row, view),
    restoredLabel: (row) => formatPLN(subcontractorPrice(row, view)),
  }
}

/**
 * „Mnożnik" — the cell that holds the multiplier itself. Same shape as the kwota policy above and
 * the same `clear`: emptying either half of the pair is the way back to „auto", so both write the
 * whole pair away rather than leaving the twin standing.
 *
 * It carries the SAME guard: the sufit judges what the company pays a crew, and a stawka is a stawka
 * whether its author was a kwota or a mnożnik. `restoredLabel` therefore names the resulting kwota,
 * not the multiplier — the sentence is about money.
 */
export function subcontractorCoeffPolicy<RowT extends ViewPricingT>(
  view: ToolPlaneT,
): CellEditPolicyT<RowT, number | null> {
  return {
    snapshot: (row) => overrideCoeffFor(row, view),
    sameEntry: (a, b) => a === b,
    restore: (row, entry) => withSource(row, view, null, entry),
    applyValue: (row, value) => withSource(row, view, null, value),
    clear: (row) => withSource(row, view, null, null),
    guard: (row) => checkSubcontractorPrice(row, view),
    restoredLabel: (row) => formatPLN(subcontractorPrice(row, view)),
  }
}

/**
 * Switching „Źródło".
 *
 * Both hand-owned sources are seeded with what the row already SHOWS, so the switch is what it claims
 * to be — a change of source, not of price: „kwota stała" takes the stawka verbatim, „własny mnożnik"
 * takes the multiplier that produces it. It can still turn the cell red without moving a liczba: the
 * ceiling judged only a hand-owned stawka, so a row sitting at 90% in „auto" is silent until the
 * switch makes the same number the row's own. That is the verdict arriving, not the price changing.
 * „auto" means „whatever the investment says", so it drops the row's own numbers and the price follows
 * the global mnożnik.
 */
export function sourceChange<RowT extends ViewPricingT>(
  rowData: RowT,
  source: PriceSourceT,
  view: ToolPlaneT,
): RowT {
  switch (source) {
    case 'amount':
      return withSource(rowData, view, subcontractorPrice(rowData, view), null)
    case 'coeff':
      return withSource(rowData, view, null, seedCoeff(rowData, view))
    default:
      return withSource(rowData, view, null, null)
  }
}

// Dividing the shown stawka by the cena j.m. covers both ways in: from „auto" it reproduces the
// investment's own współczynnik exactly, from a kwota it reproduces whatever multiple that kwota
// happened to be. At cena j.m. 0 the division says nothing (every stawka is 0 zł there), so the
// investment's współczynnik is the honest seed.
function seedCoeff(row: ViewPricingT, view: ToolPlaneT): number {
  if (row.clientPrice === 0) return effectiveCoeff(row, view)
  // Rounded, because the division is a float round-trip: seeding „auto" at 0,65 would otherwise put
  // 0,6500000000000001 into a cell the owner is about to read.
  return Math.round((subcontractorPrice(row, view) / row.clientPrice) * 10_000) / 10_000
}
