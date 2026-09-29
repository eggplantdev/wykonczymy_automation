import { COLUMN_LAYER, LAYER_NEUTRAL_COLUMNS } from '@/lib/kosztorys/columns/column-config'
import { basePriceKey } from '@/lib/kosztorys/plane-price-keys'

// The grid's third reading axis: a column belongs either to the work layer (the offer + its execution
// value, plus the etapy-ilość inputs) or to the progress tracker (per-etap wartości, % wykonania,
// Pozostało). Composes like the money axis rather than replacing anything —
// visible(col) = pickerAllows(col) AND axisAllows(col) AND layerAllows(col) — so the picker still
// wins over any mode that would show a column.
//
// Only the progress side is tagged in COLUMN_LAYER, so the three buckets are derived: `both` shows
// everything; `progress` shows the neutral context plus the tagged columns; `work` shows the neutral
// context plus everything NOT tagged progress (the untagged work columns). Without the neutral
// allowlist, "Postęp" could not hide the untagged work columns while keeping the row identifiable.

export type LayerT = 'work' | 'progress' | 'both' | 'none'

export const LAYER_DEFAULT: LayerT = 'both'

export function layerAllows(toggleKey: string, layer: LayerT): boolean {
  // Base key, exactly as axisAllows resolves it: a tag on „Cena j.m." has to reach both planes' rate
  // columns, or one concept would sit on two sides of the work/progress split.
  const key = basePriceKey(toggleKey)
  if (LAYER_NEUTRAL_COLUMNS.has(key) || layer === 'both') return true
  if (layer === 'none') return false

  const isProgress = COLUMN_LAYER[key] === 'progress'
  return layer === 'progress' ? isProgress : !isProgress
}
