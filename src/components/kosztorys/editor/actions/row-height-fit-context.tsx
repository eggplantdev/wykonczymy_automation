'use client'

import { createContext, use, type ReactNode } from 'react'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type FitRowHeightT = (row: KosztorysV2RowT) => void

const RowHeightFitContext = createContext<FitRowHeightT | null>(null)

/**
 * „Dopasuj wysokość do treści" is measured from the RENDERED grid (column widths come off the DOM),
 * so the command can only be built in the editor body — while its trigger sits in a row's „…", down
 * on `columnData` the body never assembles — the same reason CataloguePickerHost travels by context.
 * Shaped like KosztorysActionsProvider: a stateless provider + its hook, no state and no dialog.
 *
 * Not the churn EX-496 warns about: the only consumer is an OPEN menu's content, which Radix mounts
 * on demand, so a new function identity here reaches no grid cell.
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
