'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import { LAYER_DEFAULT, type LayerT } from '@/lib/kosztorys/layer'

const STORAGE_KEY = 'table-columns:kosztorys-layer'
const VALID_LAYERS: readonly LayerT[] = ['work', 'progress', 'both', 'none']

export function useLayer(): [LayerT, (layer: LayerT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_LAYERS, LAYER_DEFAULT)
}
