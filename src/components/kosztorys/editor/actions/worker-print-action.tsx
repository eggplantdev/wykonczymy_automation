'use client'

import { ClipboardPen, FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import type { WorkerTargetT } from '@/components/kosztorys/editor/actions/use-worker-actions'
import { useWorkerPrint } from '@/components/kosztorys/editor/actions/use-worker-print'
import { buildWorkerFormHtml } from '@/lib/kosztorys/print/worker'

export function WorkerPdfMenuItem({
  target,
  disabled,
}: {
  target: WorkerTargetT
  disabled: boolean
}) {
  const { worker } = useKosztorysActions()
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => worker.requestPrint(target)}>
      <FileText />
      Drukuj kosztorys pracownika (PDF)
    </DropdownMenuItem>
  )
}

export function WorkerFormMenuItem({
  workerId,
  disabled,
}: {
  workerId: number
  disabled: boolean
}) {
  const printWorker = useWorkerPrint()
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => printWorker(workerId, buildWorkerFormHtml)}
    >
      <ClipboardPen />
      Drukuj kartkę do zgłoszenia prac
    </DropdownMenuItem>
  )
}
