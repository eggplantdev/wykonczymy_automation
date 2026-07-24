'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Whether the bottom totals panel is expanded, persisted globally in localStorage: a reading
// preference of the person, not of one kosztorys — same `table-columns:` family as the money-axis /
// column pickers, so clearing that memory clears this too. Survives the editor's restore-remount,
// which a plain useState (like the section-summary's `summaryOpen`) would not.
const STORAGE_KEY = 'table-columns:kosztorys-totals-open'
const STATES = ['open', 'closed'] as const

export function useTotalsPanelOpen(): [boolean, (open: boolean) => void] {
  const [state, setState] = usePersistedEnum(STORAGE_KEY, STATES, 'open')
  return [state === 'open', (open) => setState(open ? 'open' : 'closed')]
}
