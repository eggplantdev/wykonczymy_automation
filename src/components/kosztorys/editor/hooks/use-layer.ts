'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { LAYER_DEFAULT, type LayerT } from '@/lib/kosztorys/layer'

// Active layer axis, persisted globally in localStorage — it's a reading preference of the person, not
// of one kosztorys, so the key carries no investment id and sits in the `table-columns:` family.
const STORAGE_KEY = 'table-columns:kosztorys-layer'
const VALID_LAYERS: readonly LayerT[] = ['work', 'progress', 'both', 'none']

export function useLayer(): [LayerT, (layer: LayerT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_LAYERS, LAYER_DEFAULT)
}
