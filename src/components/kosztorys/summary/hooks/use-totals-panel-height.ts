'use client'

import { usePersistedNumber } from '@/hooks/use-persisted-enum'
import { FULL_PANEL_FRACTION, isStoredPanelFraction } from '@/lib/kosztorys/totals-panel-height'

// Same `table-columns:` family as the open flag: a reading preference of the person, not of one
// kosztorys. Defaults to full height so nobody's screen changes until they drag the edge.
const STORAGE_KEY = 'table-columns:kosztorys-totals-height'

export function useTotalsPanelHeight(): [number, (fraction: number) => void] {
  return usePersistedNumber(STORAGE_KEY, FULL_PANEL_FRACTION, isStoredPanelFraction)
}
