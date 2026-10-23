'use client'

import { FileUser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function WorkerReportsButton() {
  const { workerReports } = useKosztorysActions()
  if (!workerReports || workerReports.pendingCount === 0) return null

  return (
    <Button size="sm" variant="warningOutline" onClick={() => workerReports.openReport()}>
      <FileUser />
      Zgłoszenia prac ({workerReports.pendingCount})
    </Button>
  )
}
