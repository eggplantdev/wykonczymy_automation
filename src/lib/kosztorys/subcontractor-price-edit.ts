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
 * The optimistic mirror of `normalizeOverridePatch`, which does the same to the patch that reaches the
 * DB. Without the mirror the row on screen and the row in the base disagree for exactly one refresh, and
 * what the user sees during it is the stawka they just replaced.
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
 * `clear` writes `null`: an emptied field means „ask the investment" here, and a `0` would be a stawka
 * of zero złotych.
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

function seedCoeff(row: ViewPricingT, view: ToolPlaneT): number {
  if (row.clientPrice === 0) return effectiveCoeff(row, view)
  // Rounded, because the division is a float round-trip: seeding „auto" at 0,65 would otherwise put
  // 0,6500000000000001 into a cell the owner is about to read.
  return Math.round((subcontractorPrice(row, view) / row.clientPrice) * 10_000) / 10_000
}
