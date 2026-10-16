import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

/**
 * An undecided plane (`null`) is NOT a plane and matches neither view: charging it to a crew nobody
 * picked would be a fabricated debt.
 */
export function stageAppliesToView(stage: KosztorysStageT, view: PriceViewT): boolean {
  if (view === 'client') return true
  return stage.plane === view
}

export function stagesForView(stages: KosztorysStageT[], view: PriceViewT): KosztorysStageT[] {
  return view === 'client' ? stages : stages.filter((st) => stageAppliesToView(st, view))
}
