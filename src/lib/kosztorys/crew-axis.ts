import type { PriceViewT } from '@/lib/kosztorys/calc'
import { planeOfPriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

export type CrewAxisT = ToolPlaneT | 'both' | 'none'

export const CREW_AXIS_DEFAULT: CrewAxisT = 'none'

export const crewAxisShows = (axis: CrewAxisT, plane: ToolPlaneT): boolean =>
  axis === 'both' || axis === plane

export const effectiveCrewAxis = (view: PriceViewT, axis: CrewAxisT): CrewAxisT =>
  view === 'client' ? axis : view

export function crewAxisAllows(toggleKey: string, axis: CrewAxisT): boolean {
  // The full id, never `basePriceKey`: resolving to the shared base would make it answer for both
  // at once.
  const plane = planeOfPriceKey(toggleKey)
  if (plane === null) return true
  return crewAxisShows(axis, plane)
}
