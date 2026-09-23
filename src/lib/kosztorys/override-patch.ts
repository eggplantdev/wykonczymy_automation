import { namesFigure } from '@/lib/kosztorys/calc'
import { OVERRIDE_COEFF_FIELDS, OVERRIDE_FIELDS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ItemPatchT } from '@/lib/kosztorys/types'

/**
 * Expand a patch touching ONE column of a plane's stawka pair into a patch that writes BOTH.
 *
 * This is the whole reason a second column is safe again (EX-865). The grid diffs a row into one
 * entry per field and fires `updateItemFieldAction` separately for each, so two columns over one
 * concept would otherwise persist as two unordered writes — and the half-written state is silent:
 * a leftover kwota beside a cleared mnożnik reads as a perfectly ordinary frozen stawka. EX-766
 * deleted the pair over exactly this; the answer is atomicity here, not one column.
 *
 * The invariant it holds: after any write, at most one of a plane's two columns is non-null. Nothing
 * in the types or in Payload can state that, so it is stated here.
 *
 * Per plane, and only for a plane the patch actually names — a write to „z narzędziami" must not
 * clear the rate someone set for „bez narzędzi".
 */
// The patch is a loose bag of column values, so a key may hold anything the wire carried; only a
// number can be a stawka.
const coerceFigure = (value: unknown): number | null => (typeof value === 'number' ? value : null)

export function normalizeOverridePatch(patch: ItemPatchT): ItemPatchT {
  const normalized = { ...patch }

  for (const plane of TOOL_PLANES) {
    const valueField = OVERRIDE_FIELDS[plane]
    const coeffField = OVERRIDE_COEFF_FIELDS[plane]
    const touchesValue = valueField in patch
    const touchesCoeff = coeffField in patch
    if (!touchesValue && !touchesCoeff) continue

    // `namesFigure`, not `typeof === 'number'`: the writer and `priceSourceOf` — the reader that
    // decides which half of the pair wins — must run the SAME test, or a NaN is a chosen source to
    // one and „auto" to the other. `0` is a choice like any other — a stawka of zero złotych — so it
    // lands here, not in the clearing branch below. Checked BEFORE clearing, because a caller that
    // sends the whole pair at once (the import, the katalog) has already decided, and one of its two
    // keys is legitimately null.
    if (namesFigure(coerceFigure(patch[coeffField]))) {
      normalized[valueField] = null
      continue
    }
    if (namesFigure(coerceFigure(patch[valueField]))) {
      normalized[coeffField] = null
      continue
    }

    // Nothing but a cleared cell left: „auto" is the state where BOTH columns are empty, and leaving
    // the twin behind is what would resurrect the stawka the user just cleared.
    normalized[valueField] = null
    normalized[coeffField] = null
  }

  return normalized
}
