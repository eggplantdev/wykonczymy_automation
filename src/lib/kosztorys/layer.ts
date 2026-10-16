import { COLUMN_LAYER, LAYER_NEUTRAL_COLUMNS } from '@/lib/kosztorys/columns/column-config'
import { basePriceKey } from '@/lib/kosztorys/plane-price-keys'

export type LayerT = 'work' | 'progress' | 'both' | 'none'

export const LAYER_DEFAULT: LayerT = 'both'

export function layerAllows(toggleKey: string, layer: LayerT): boolean {
  // a tag on „Cena j.m." has to reach both planes' rate columns, or one concept would sit on two
  // sides of the work/progress split.
  const key = basePriceKey(toggleKey)
  if (LAYER_NEUTRAL_COLUMNS.has(key) || layer === 'both') return true
  if (layer === 'none') return false

  const isProgress = COLUMN_LAYER[key] === 'progress'
  return layer === 'progress' ? isProgress : !isProgress
}
