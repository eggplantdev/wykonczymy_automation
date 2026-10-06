'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import { ReorderDialog } from '@/components/kosztorys/editor/dialogs/reorder/reorder-dialog'

const ReorderOpenContext = createContext<((open: boolean) => void) | null>(null)

// „Ustaw kolejność…" opens from „Opcje" and from every „…" in the „Akcje" column — different
// subtrees, so like CataloguePickerHost it wraps the whole body. The context holds useState's
// setter, which never changes identity, so opening the dialog re-renders only this host (EX-496).
export function ReorderHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <ReorderOpenContext value={setOpen}>
      {children}
      {open && <ReorderDialog onClose={() => setOpen(false)} />}
    </ReorderOpenContext>
  )
}

export function useOpenReorder() {
  const setOpen = use(ReorderOpenContext)
  if (!setOpen) throw new Error('useOpenReorder must be used within ReorderHost')
  return () => setOpen(true)
}
