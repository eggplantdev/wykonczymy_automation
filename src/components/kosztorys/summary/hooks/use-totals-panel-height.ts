'use client'

import { usePersistedNumber } from '@/hooks/use-persisted-value'
import { FULL_PANEL_FRACTION, isStoredPanelFraction } from '@/lib/kosztorys/totals-panel-height'

// Same `table-columns:` family as the open flag: a reading preference of the person, not of one
// kosztorys.
const STORAGE_KEY = 'table-columns:kosztorys-totals-height'

export function useTotalsPanelHeight(): [number, (fraction: number) => void] {
  return usePersistedNumber(STORAGE_KEY, FULL_PANEL_FRACTION, isStoredPanelFraction)
}
