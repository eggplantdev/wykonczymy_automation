import type { PriceViewT } from '@/lib/kosztorys/calc'
import { planeOfPriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

// The grid's fourth reading axis: whose rate is on screen. Both planes' rate columns assemble in every
// view — the owner compares them without switching tabs — which left „Cena j.m. netto — bez narzędzi"
// standing in the Inwestor view with nothing on the toolbar able to put it away (owner, 2026-09-28).
// This is that switch. Composes like the other two rather than replacing the picker:
// visible(col) = pickerAllows(col) AND axisAllows(col) AND layerAllows(col) AND crewAxisAllows(col).
//
// It also gates the plane-bound rows in „Filtry", so one control answers „czy ta płaszczyzna mnie
// teraz obchodzi" instead of a column gate and a filter gate that can say different things.

export type CrewAxisT = ToolPlaneT | 'both' | 'none'

// Off, not 'both': the four rate columns qualify the offer rather than being it, and unfurling them on
// a first visit buries what the reader came for.
export const CREW_AXIS_DEFAULT: CrewAxisT = 'none'

export const crewAxisShows = (axis: CrewAxisT, plane: ToolPlaneT): boolean =>
  axis === 'both' || axis === plane

/**
 * The axis the grid actually reads at. A subcontractor view IS a choice of plane, so it pins its own —
 * entering „Bez narzędzi" to find that plane's stawka switched off would be the control contradicting
 * the view. Same shape as `effectiveMoneyAxis`, and the stored pick is untouched: it answers again on
 * the way back to „Inwestor".
 */
export const effectiveCrewAxis = (view: PriceViewT, axis: CrewAxisT): CrewAxisT =>
  view === 'client' ? axis : view

export function crewAxisAllows(toggleKey: string, axis: CrewAxisT): boolean {
  // The full id, never `basePriceKey`: unlike the money and layer tags, this axis exists precisely to
  // tell the two planes apart, so resolving to the shared base would make it answer for both at once.
  const plane = planeOfPriceKey(toggleKey)
  if (plane === null) return true
  return crewAxisShows(axis, plane)
}
