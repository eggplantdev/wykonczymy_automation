'use client'

import { createContext, use } from 'react'

export const ReorderOpenContext = createContext<((open: boolean) => void) | null>(null)

export function useOpenReorder() {
  const setOpen = use(ReorderOpenContext)
  if (!setOpen) throw new Error('useOpenReorder must be used within ReorderHost')
  return () => setOpen(true)
}
