'use client'

import { createContext, use } from 'react'

// A card renders the same cells as the table row but has room for words: under this provider a row
// action prints its verb beside the icon, so the button reads without a column header above it.
export const RowActionLabels = createContext(false)

export function useRowActionLabels() {
  return use(RowActionLabels)
}
