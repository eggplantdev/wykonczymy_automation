'use client'

import { usePersistedFlag } from '@/hooks/use-persisted-value'

const STORAGE_KEY = 'nav:sidebar-collapsed'
const STATES = ['collapsed', 'expanded'] as const

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  return usePersistedFlag(STORAGE_KEY, STATES, false)
}
