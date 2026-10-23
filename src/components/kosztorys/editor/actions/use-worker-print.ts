'use client'

import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { WorkerPrintArgsT } from '@/lib/kosztorys/print/worker'
import { resolveSectionFills } from '@/lib/kosztorys/print/section-fills'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import {
  getWorkerKosztorysPrintData,
  type WorkerKosztorysPrintDataT,
} from '@/lib/queries/worker-kosztorys-print-endpoint'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { toastMessage } from '@/lib/utils/toast'

export function useWorkerPrint() {
  const { investmentId, investmentName } = useKosztorysEditorContext()

  return function printWorker(workerId: number, build: (args: WorkerPrintArgsT) => string) {
    const target = openPrintWindow(investmentName)
    if (!target) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    const fillByColorKey = resolveSectionFills()

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
}
