'use client'

import { useState } from 'react'
import { usePersistedFlag } from '@/hooks/use-persisted-value'

export const OPEN_STATES = ['open', 'closed'] as const

export function useSectionOpen(
  storageKey: string | undefined,
  defaultOpen: boolean,
): [boolean, (open: boolean) => void] {
  const [local, setLocal] = useState(defaultOpen)
  const stored = usePersistedFlag(storageKey ?? '', OPEN_STATES, defaultOpen)

  return storageKey ? stored : [local, setLocal]
}
