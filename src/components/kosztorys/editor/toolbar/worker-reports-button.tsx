'use client'

import { FileUser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function WorkerReportsButton() {
  const { workerReports } = useKosztorysActions()
  if (!workerReports || workerReports.pendingCount === 0) return null

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      onClick={() => workerReports.openReport()}
    >
      <FileUser />
      Zgłoszenia prac ({workerReports.pendingCount})
    </Button>
  )
}
