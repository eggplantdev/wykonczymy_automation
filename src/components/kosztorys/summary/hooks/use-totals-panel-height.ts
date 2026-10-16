'use client'

import { usePersistedNumber } from '@/hooks/use-persisted-value'
import { FULL_PANEL_FRACTION, isStoredPanelFraction } from '@/lib/kosztorys/totals-panel-height'

const STORAGE_KEY = 'table-columns:kosztorys-totals-height'

export function useTotalsPanelHeight(): [number, (fraction: number) => void] {
  return usePersistedNumber(STORAGE_KEY, FULL_PANEL_FRACTION, isStoredPanelFraction)
}
