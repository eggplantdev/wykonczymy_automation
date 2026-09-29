'use client'

import { FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { buildWorkerPrintHtml } from '@/lib/kosztorys/print/worker'
import { resolveSectionFills } from '@/lib/kosztorys/print/popup'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { getWorkerKosztorysPrintData } from '@/lib/queries/worker-kosztorys-print-endpoint'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { toastMessage } from '@/lib/utils/toast'

export function WorkerPrintMenuItem({
  workerId,
  disabled,
}: {
  workerId: number
  disabled: boolean
}) {
  const { investmentId, investmentName } = useKosztorysEditorContext()

  function handlePrint() {
    // Opened with the click, filled once the projection lands — see `openPrintWindow`.
    const target = openPrintWindow(investmentName)
    if (!target) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    const fillByColorKey = resolveSectionFills()

    // The menu disabled a blocked worker off the editor's etapy; the server answers again from its
    // own read, and an etap changed in between is refused here with the same sentence.
    const render = (data: WorkerKosztorysT | null) => {
      if (!data || data.kind === 'blocked') {
        target.close()
        toastMessage(
          data ? WORKER_SCOPE_BLOCK_MESSAGES[data.reason] : 'Nie znaleziono pracownika',
          'error',
        )
        return
      }
      try {
        writeAndPrint(
          target,
          buildWorkerPrintHtml({
            data,
            logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
            fillByColorKey,
          }),
        )
      } catch {
        target.close()
        toastMessage('Nie udało się przygotować wydruku', 'error')
      }
    }

    void getWorkerKosztorysPrintData(investmentId, workerId).then(render, () => {
      target.close()
      toastMessage('Nie udało się odczytać kosztorysu pracownika', 'error')
    })
  }

  return (
    <DropdownMenuItem disabled={disabled} onSelect={handlePrint}>
      <FileText />
      Drukuj PDF
    </DropdownMenuItem>
  )
}
