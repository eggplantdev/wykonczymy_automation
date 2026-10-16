'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import { ReorderDialog } from '@/components/kosztorys/editor/dialogs/reorder/reorder-dialog'

const ReorderOpenContext = createContext<((open: boolean) => void) | null>(null)

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
