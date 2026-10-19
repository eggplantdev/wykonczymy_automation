'use client'

import { WandSparkles } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { SCAN_REPORT_LABEL } from '@/lib/kosztorys/worker-report/constants'
import type { ScanWorkerT } from '@/lib/db/stage-memberships'

export function ScanReportMenuItem({ workers }: { workers: ScanWorkerT[] }) {
  const { scan } = useKosztorysActions()
  return (
    <DropdownMenuItem disabled={workers.length === 0} onSelect={() => scan.requestScan(workers)}>
      <WandSparkles className="text-neon-cyan" />
      <span className="text-neon-cyan font-semibold">{SCAN_REPORT_LABEL}</span>
    </DropdownMenuItem>
  )
}
