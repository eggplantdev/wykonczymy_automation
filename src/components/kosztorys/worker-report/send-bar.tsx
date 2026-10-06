'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { extraState } from '@/components/kosztorys/worker-report/extra-state'
import type { useReportDraft } from '@/components/kosztorys/worker-report/use-report-draft'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import { sendWorkerReportAction } from '@/lib/actions/worker-report'
import type { SendReportLineT, WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'
import { failureMessage } from '@/lib/i18n/failure-message'
import { useTranslation } from '@/hooks/use-translation'
import { toastMessage } from '@/lib/utils/toast'
import { settleAction } from '@/lib/utils/settle-action'

export type SentT = { lineCount: number }

type PropsT = {
  token: string
  data: WorkerReportFormDataT
  draft: ReturnType<typeof useReportDraft>
  onSent: (sent: SentT) => void
}

export function SendBar({ token, data, draft, onSent }: PropsT) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const { locale, t } = useTranslation('report')
  const itemQtys = data.sections
    .flatMap((section) => section.items)
    .map((item) => ({
      itemId: item.id,
      parsed: parseReportQty(draft.draft.qtyByItem[item.id] ?? ''),
    }))
  const itemLines = itemQtys.flatMap(({ itemId, parsed }): SendReportLineT[] =>
    parsed.kind === 'value' ? [{ kind: 'rozpiska', itemId, qty: parsed.value }] : [],
  )
  const extraLines = draft.draft.extras.flatMap((extra): SendReportLineT[] => {
    const parsed = parseReportQty(extra.qty)
    return extraState(extra) === 'complete' && parsed.kind === 'value'
      ? [
          {
            kind: 'extra',
            description: extra.description.trim(),
            unit: extra.unit,
            qty: parsed.value,
          },
        ]
      : []
  })
  const lineCount = itemLines.length + extraLines.length
  const hasInvalid =
    itemQtys.some(({ parsed }) => parsed.kind === 'invalid') ||
    draft.draft.extras.some((extra) => extraState(extra) === 'invalid')

  const send = async () => {
    setIsSending(true)
    const result = await settleAction(() =>
      sendWorkerReportAction(token, [...itemLines, ...extraLines]),
    )
    setIsSending(false)
    setIsConfirmOpen(false)
    // The szkic survives a refused send, so nothing he typed is lost to a closed investment or a
    // dropped connection.
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error', 6000)
      return
    }
    draft.clear()
    toastMessage(t('sentToast'))
    onSent({ lineCount })
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {hasInvalid && (
          <p className="text-destructive text-sm whitespace-nowrap">{t('fixErrors')}</p>
        )}
        <Button
          disabled={lineCount === 0 || hasInvalid || isSending}
          onClick={() => setIsConfirmOpen(true)}
        >
          {isSending ? t('sending') : t('send')}
          {lineCount > 0 && ` (${lineCount})`}
        </Button>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        variant="neutral"
        title={t('confirmTitle')}
        description={t('confirmDescription', {
          items: itemLines.length,
          extras: extraLines.length,
        })}
        confirmLabel={t('send')}
        onConfirm={send}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
