'use client'

import { useState } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { ReasonField } from '@/components/ui/reason-field'
import { rejectReceiptAction } from '@/lib/actions/receipt-confirmation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { CANCEL_REASON_MAX_LENGTH, CANCEL_REASON_MIN_LENGTH } from '@/lib/schemas/transfer'
import { formatPLN } from '@/lib/utils/format-currency'
import { settleAction } from '@/lib/utils/settle-action'
import { syncAppBadge } from '@/lib/push/push-client'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  transactionId: number
  amount: number
  onClose: () => void
}

export function RejectReceiptDialog({ transactionId, amount, onClose }: PropsT) {
  const { locale, t } = useTranslation('workerPage')
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)
  const trimmedReason = reason.trim()
  const isReasonValid = trimmedReason.length >= CANCEL_REASON_MIN_LENGTH

  async function handleReject() {
    if (!isReasonValid) return
    setIsPending(true)
    const result = await settleAction(() =>
      rejectReceiptAction(transactionId, { reason: trimmedReason }),
    )
    setIsPending(false)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return
    }
    toastMessage(t('receiptRejected'), 'success')
    void syncAppBadge()
    onClose()
  }

  return (
    <FormDialogShell
      open
      onOpenChange={(next) => !next && onClose()}
      showCloseButton={false}
      title={t('receiptRejectTitle', { amount: formatPLN(amount) })}
      description={t('receiptRejectDescription')}
      confirmLabel={t('receiptReject')}
      confirmVariant="destructive"
      pending={isPending}
      confirmDisabled={!isReasonValid}
      onConfirm={handleReject}
    >
      <ReasonField
        id={`receipt-reject-reason-${transactionId}`}
        value={reason}
        onChange={setReason}
        min={CANCEL_REASON_MIN_LENGTH}
        max={CANCEL_REASON_MAX_LENGTH}
        label={t('receiptRejectReason')}
        placeholder={t('receiptRejectPlaceholder')}
        counterText={({ length, missing }) =>
          missing === 0
            ? t('receiptReasonCount', { length, max: CANCEL_REASON_MAX_LENGTH })
            : t('receiptReasonMissing', { missing })
        }
        disabled={isPending}
      />
    </FormDialogShell>
  )
}
