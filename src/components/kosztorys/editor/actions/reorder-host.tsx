'use client'

import { useState, type ReactNode } from 'react'
import { ReorderOpenContext } from '@/components/kosztorys/editor/actions/reorder-open'
import { ReorderDialog } from '@/components/kosztorys/editor/dialogs/reorder/reorder-dialog'

export function ReorderHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <ReorderOpenContext value={setOpen}>
      {children}
      {open && <ReorderDialog onClose={() => setOpen(false)} />}
    </ReorderOpenContext>
  )
}
