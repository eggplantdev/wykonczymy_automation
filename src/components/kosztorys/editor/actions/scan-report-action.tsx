'use client'

import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import type { ScanWorkerT } from '@/lib/db/stage-memberships'

export type ScanReportActionT = {
  target: ScanWorkerT | undefined
  open: boolean
  setOpen: (open: boolean) => void
  requestScan: (target: ScanWorkerT) => void
}

export function useScanReportAction(): ScanReportActionT {
  const [target, setTarget] = useState<ScanWorkerT>()
  const [open, setOpen] = useState(false)
  return {
    target,
    open,
    setOpen,
    requestScan: (next) => {
      setTarget(next)
      setOpen(true)
    },
  }
}

export function ScanReportMenuItem({
  target,
  disabled,
}: {
  target: ScanWorkerT
  disabled: boolean
}) {
  const { scan } = useKosztorysActions()
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => scan.requestScan(target)}>
      <ScanLine />
      Wczytaj z kartki
    </DropdownMenuItem>
  )
}
