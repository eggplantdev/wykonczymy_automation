'use client'

import { createContext, use } from 'react'

export type ColumnWidthAllT = { openAll: () => void; resetAll: () => void }

export const ColumnWidthAllContext = createContext<ColumnWidthAllT | undefined>(undefined)

export function useColumnWidthAll() {
  return use(ColumnWidthAllContext)
}
