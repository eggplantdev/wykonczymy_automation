'use client'

import { useSyncExternalStore } from 'react'

// False on the server and in the hydration pass, so markup for the narrow layout is what hydrates;
// the wide one takes over on the first client render.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
