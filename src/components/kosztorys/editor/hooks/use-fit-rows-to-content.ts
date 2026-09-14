'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Whether every row sizes itself to its text instead of resting at 32px. A reading preference of the
// person, not of one kosztorys, so the key carries no investment id — the twin of the dragged heights
// in `kosztorys-v2-row-heights`, which it deliberately does NOT write to: this remembers HOW the grid
// is read, not what any individual row was set to.
//
// Stored as a word rather than a flag because usePersistedEnum is the store every other persisted
// editor preference already rides; a boolean would be a second serialization for one value.
const STORAGE_KEY = 'kosztorys-v2-row-fit'
const MODES = ['content', 'resting'] as const

export function useFitRowsToContent(): [boolean, () => void] {
  const [mode, setMode] = usePersistedEnum(STORAGE_KEY, MODES, 'resting')
  return [mode === 'content', () => setMode(mode === 'content' ? 'resting' : 'content')]
}
