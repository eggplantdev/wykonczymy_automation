'use client'

import { useState } from 'react'
import { WandSparkles } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { SCAN_REPORT_LABEL } from '@/lib/kosztorys/worker-report/constants'
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

export function ScanReportMenuItem({ workers }: { workers: ScanWorkerT[] }) {
  const { scan } = useKosztorysActions()
  return (
    <DropdownMenuItem disabled={workers.length === 0} onSelect={() => scan.requestScan(workers)}>
      <WandSparkles className="text-neon-cyan" />
      <span className="text-neon-cyan font-semibold">{SCAN_REPORT_LABEL}</span>
    </DropdownMenuItem>
  )
}
