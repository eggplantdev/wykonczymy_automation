'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import type { useReportDraft } from '@/components/kosztorys/worker-report/use-report-draft'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import { sendWorkerReportAction } from '@/lib/actions/worker-report'
import type { SendReportLineT, WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'
import { toastMessage } from '@/lib/utils/toast'

export const POZYCJA_FORMS = ['pozycja', 'pozycje', 'pozycji'] as const

export type SentT = { lineCount: number }

type PropsT = {
  token: string
  data: WorkerReportFormDataT
  draft: ReturnType<typeof useReportDraft>
  onSent: (sent: SentT) => void
}

// An untouched row added on the grid is skipped like an empty pozycja; a half-filled one blocks the
// send, since dropping it silently would lose work he meant to report.
function extraState(extra: ExtraWorkT): 'blank' | 'complete' | 'invalid' {
  const qty = parseReportQty(extra.qty)
  if (extra.description.trim() === '' && extra.unit === '' && qty.kind === 'empty') return 'blank'
  if (extra.description.trim() !== '' && extra.unit !== '' && qty.kind === 'value')
    return 'complete'
  return 'invalid'
}

export function SendBar({ token, data, draft, onSent }: PropsT) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const qtyOf = (itemId: number) => draft.draft.qtyByItem[itemId] ?? ''

  const allItems = data.sections.flatMap((section) => section.items)
  const filledItemCount = allItems.filter(
    (item) => parseReportQty(qtyOf(item.id)).kind === 'value',
  ).length
  const completeExtras = draft.draft.extras.filter((extra) => extraState(extra) === 'complete')
  const extraCount = completeExtras.length
  const lineCount = filledItemCount + extraCount
  const hasInvalid =
    allItems.some((item) => parseReportQty(qtyOf(item.id)).kind === 'invalid') ||
    draft.draft.extras.some((extra) => extraState(extra) === 'invalid')

  const send = async () => {
    const itemLines = allItems.flatMap((item): SendReportLineT[] => {
      const parsed = parseReportQty(qtyOf(item.id))
      return parsed.kind === 'value'
        ? [{ kind: 'rozpiska', itemId: item.id, qty: parsed.value }]
        : []
    })
    const extraLines = completeExtras.flatMap((extra): SendReportLineT[] => {
      const parsed = parseReportQty(extra.qty)
      if (parsed.kind !== 'value') return []
      return [
        {
          kind: 'extra',
          description: extra.description.trim(),
          unit: extra.unit,
          qty: parsed.value,
        },
      ]
    })
    setIsSending(true)
    const result = await sendWorkerReportAction(token, [...itemLines, ...extraLines])
    setIsSending(false)
    setIsConfirmOpen(false)
    // The szkic survives a refused send, so nothing he typed is lost to a closed investment or a
    // dropped connection.
    if (!result.success) {
      toastMessage(result.error, 'error', 6000)
      return
    }
    draft.clear()
    toastMessage('Zgłoszenie wysłane do weryfikacji')
    onSent({ lineCount })
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {hasInvalid && (
          <p className="text-destructive text-sm whitespace-nowrap">Popraw błędne ilości</p>
        )}
        <Button
          disabled={lineCount === 0 || hasInvalid || isSending}
          onClick={() => setIsConfirmOpen(true)}
        >
          {isSending ? 'Wysyłanie…' : 'Wyślij'}
        </Button>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        variant="neutral"
        title="Wysłać do weryfikacji?"
        description={`${filledItemCount} z rozpiski, ${extraCount} dopisanych ręcznie. Po wysłaniu zgłoszenia nie można już zmienić.`}
        confirmLabel="Wyślij"
        onConfirm={send}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
