'use client'

import { createContext, use } from 'react'

export const RowActionLabels = createContext(false)

export function useRowActionLabels() {
  return use(RowActionLabels)
}
