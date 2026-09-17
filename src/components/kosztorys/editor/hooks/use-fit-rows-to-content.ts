'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Whether every row sizes to its text instead of resting at 32px — a per-person preference, so the
// key carries no investment id, and distinct from the dragged heights in `kosztorys-v2-row-heights`.
// A word, not a flag, so it rides the same usePersistedEnum store as the other editor preferences.
const STORAGE_KEY = 'kosztorys-v2-row-fit'
const MODES = ['content', 'resting'] as const

export function useFitRowsToContent(): [boolean, () => void] {
  const [mode, setMode] = usePersistedEnum(STORAGE_KEY, MODES, 'resting')
  return [mode === 'content', () => setMode(mode === 'content' ? 'resting' : 'content')]
}
