'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'

const STORAGE_KEY = 'kosztorys-v2-row-fit'
const MODES = ['content', 'resting'] as const

export function useFitRowsToContent(): [boolean, () => void] {
  const [mode, setMode] = usePersistedEnum(STORAGE_KEY, MODES, 'resting')
  return [mode === 'content', () => setMode(mode === 'content' ? 'resting' : 'content')]
}
