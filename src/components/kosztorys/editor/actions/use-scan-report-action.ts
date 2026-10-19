'use client'

import { useState } from 'react'
import type { ScanWorkerT } from '@/lib/db/stage-memberships'

export type ScanReportActionT = {
  workers: ScanWorkerT[]
  open: boolean
  setOpen: (open: boolean) => void
  requestScan: (workers: ScanWorkerT[]) => void
}

export function useScanReportAction(): ScanReportActionT {
  const [workers, setWorkers] = useState<ScanWorkerT[]>([])
  const [open, setOpen] = useState(false)
  return {
    workers,
    open,
    setOpen,
    requestScan: (next) => {
      setWorkers(next)
      setOpen(true)
    },
  }
}
