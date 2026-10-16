'use client'

import { usePersistedFlag } from '@/hooks/use-persisted-value'

const STORAGE_KEY = 'table-columns:kosztorys-totals-open'
// An empty kosztorys keeps its own key rather than having the read overridden by a `hasRows` flag:
// an override makes the toggle a dead button.
const EMPTY_STORAGE_KEY = 'table-columns:kosztorys-totals-open-empty'
const STATES = ['open', 'closed'] as const

export function useTotalsPanelOpen(hasRows = true): [boolean, (open: boolean) => void] {
  return usePersistedFlag(hasRows ? STORAGE_KEY : EMPTY_STORAGE_KEY, STATES, hasRows)
}
