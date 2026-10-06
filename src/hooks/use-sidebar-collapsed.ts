'use client'

import { usePersistedFlag } from '@/hooks/use-persisted-value'

// Whether the desktop sidebar is collapsed to icons, persisted in localStorage so the choice
// survives navigation and reloads. The stable server snapshot is 'expanded', so the first client
// render matches the server one and a collapsed sidebar widens after hydration.
const STORAGE_KEY = 'nav:sidebar-collapsed'
const STATES = ['collapsed', 'expanded'] as const

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  return usePersistedFlag(STORAGE_KEY, STATES, false)
}
