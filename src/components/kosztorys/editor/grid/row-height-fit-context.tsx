'use client'

import { createContext, use, type ReactNode } from 'react'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type FitRowHeightT = (row: KosztorysV2RowT) => void

const RowHeightFitContext = createContext<FitRowHeightT | null>(null)

export function RowHeightFitProvider({
  fit,
  children,
}: {
  fit?: FitRowHeightT
  children: ReactNode
}) {
  return <RowHeightFitContext value={fit ?? null}>{children}</RowHeightFitContext>
}

export function useRowHeightFit(): FitRowHeightT | null {
  return use(RowHeightFitContext)
}
