'use client'

import { ClipboardPen, FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { buildWorkerFormHtml, buildWorkerPrintHtml } from '@/lib/kosztorys/print/worker'
import { resolveSectionFills } from '@/lib/kosztorys/print/section-fills'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import {
  getWorkerKosztorysPrintData,
  type WorkerKosztorysPrintDataT,
} from '@/lib/queries/worker-kosztorys-print-endpoint'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { toastMessage } from '@/lib/utils/toast'

const VARIANTS = {
  pdf: { build: buildWorkerPrintHtml, label: 'Drukuj PDF', Icon: FileText },
  form: { build: buildWorkerFormHtml, label: 'Drukuj do wypełnienia', Icon: ClipboardPen },
}

export function WorkerPrintMenuItem({
  workerId,
  disabled,
  variant,
}: {
  workerId: number
  disabled: boolean
  variant: keyof typeof VARIANTS
}) {
  const { build, label, Icon } = VARIANTS[variant]
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
    const refuse = (message: string) => {
      target.close()
      toastMessage(message, 'error')
    }
    const render = (printData: WorkerKosztorysPrintDataT | null) => {
      if (!printData) return refuse('Nie znaleziono pracownika')
      const { data, language, sectionTranslations } = printData
      if (data.kind === 'blocked') return refuse(WORKER_SCOPE_BLOCK_MESSAGES[data.reason])
      try {
        writeAndPrint(
          target,
          build({
            data,
            logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
            fillByColorKey,
            locale: language,
            sectionTranslations,
          }),
        )
      } catch {
        refuse('Nie udało się przygotować wydruku')
      }
    }

    void getWorkerKosztorysPrintData(investmentId, workerId).then(render, () =>
      refuse('Nie udało się odczytać kosztorysu pracownika'),
    )
  }

  return (
    <DropdownMenuItem disabled={disabled} onSelect={handlePrint}>
      <Icon />
      {label}
    </DropdownMenuItem>
  )
}
