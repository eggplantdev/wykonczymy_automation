'use client'

import { createContext, use, type ReactNode } from 'react'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type FitRowHeightT = (row: KosztorysV2RowT) => void

const RowHeightFitContext = createContext<FitRowHeightT | null>(null)

/**
 * The fit is measured off the rendered grid (editor body only), but its trigger sits in a row menu
 * below where `columnData` is assembled. Not EX-496 churn: the only consumer is an open menu's
 * content, mounted on demand, so a new function identity never reaches a grid cell.
 */
export function RowHeightFitProvider({
  fit,
  children,
}: {
  // Absent in the client's preview, which has neither a handle nor a row menu.
  fit?: FitRowHeightT
  children: ReactNode
}) {
  return <RowHeightFitContext value={fit ?? null}>{children}</RowHeightFitContext>
}

export function useRowHeightFit(): FitRowHeightT | null {
  return use(RowHeightFitContext)
}
