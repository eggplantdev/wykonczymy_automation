'use client'

import { usePersistedFlag } from '@/hooks/use-persisted-value'

const STORAGE_KEY = 'forms:ai-translate'
const STATES = ['on', 'off'] as const

export function useAiTranslate(): [boolean, (next: boolean) => void] {
  return usePersistedFlag(STORAGE_KEY, STATES, true)
}
