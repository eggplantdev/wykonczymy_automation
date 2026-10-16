import { namesFigure } from '@/lib/kosztorys/calc'
import { OVERRIDE_COEFF_FIELDS, OVERRIDE_FIELDS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ItemPatchT } from '@/lib/kosztorys/types'

const coerceFigure = (value: unknown): number | null => (typeof value === 'number' ? value : null)

// The grid diffs a row into one entry per field and fires `updateItemFieldAction` separately for
// each, so two columns over one concept would otherwise persist as two unordered writes.
export function normalizeOverridePatch(patch: ItemPatchT): ItemPatchT {
  const normalized = { ...patch }

  for (const plane of TOOL_PLANES) {
    const valueField = OVERRIDE_FIELDS[plane]
    const coeffField = OVERRIDE_COEFF_FIELDS[plane]
    const touchesValue = valueField in patch
    const touchesCoeff = coeffField in patch
    if (!touchesValue && !touchesCoeff) continue

    // `namesFigure`, not `typeof === 'number'`: the writer and `priceSourceOf` must run the SAME
    // test, or a NaN is a chosen source to one and „auto" to the other.
    if (namesFigure(coerceFigure(patch[coeffField]))) {
      normalized[valueField] = null
      continue
    }
    if (namesFigure(coerceFigure(patch[valueField]))) {
      normalized[coeffField] = null
      continue
    }

    // Leaving the twin behind is what would resurrect the stawka the user just cleared.
    normalized[valueField] = null
    normalized[coeffField] = null
  }

  return normalized
}
