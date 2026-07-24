'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { PROGRESS_DISPLAY_DEFAULT, type ProgressDisplayT } from '@/lib/kosztorys/progress-display'

// Active progress display, persisted globally in localStorage — same reasoning as useMoneyAxis
// (a reading preference of the person, not of one kosztorys, filed under the `table-columns:` family).
const STORAGE_KEY = 'table-columns:kosztorys-progress-display'
const VALID_DISPLAYS: readonly ProgressDisplayT[] = ['values', 'percent', 'both', 'none']

export function useProgressDisplay(): [ProgressDisplayT, (display: ProgressDisplayT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_DISPLAYS, PROGRESS_DISPLAY_DEFAULT)
}
