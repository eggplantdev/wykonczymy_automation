'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Whether the bottom totals panel is expanded, persisted globally in localStorage: a reading
// preference of the person, not of one kosztorys — same `table-columns:` family as the money-axis /
// column pickers, so clearing that memory clears this too. Survives the editor's restore-remount,
// which a plain useState would not.
const STORAGE_KEY = 'table-columns:kosztorys-totals-open'
// An empty kosztorys keeps its own preference under its own key rather than having the read
// overridden by a `hasRows` flag: an override makes the toggle a dead button — the click writes
// `'open'` and the read still answers `false`. Two keys mean opening the panel over an empty
// kosztorys is normal and sticky, while the preference built up on a kosztorys with rows never
// decides the first screen of a fresh investment.
const EMPTY_STORAGE_KEY = 'table-columns:kosztorys-totals-open-empty'
const STATES = ['open', 'closed'] as const

export function useTotalsPanelOpen(hasRows = true): [boolean, (open: boolean) => void] {
  const [state, setState] = usePersistedEnum(
    hasRows ? STORAGE_KEY : EMPTY_STORAGE_KEY,
    STATES,
    hasRows ? 'open' : 'closed',
  )
  return [state === 'open', (open) => setState(open ? 'open' : 'closed')]
}
