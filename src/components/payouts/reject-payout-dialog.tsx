'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { ReasonField } from '@/components/ui/reason-field'
import { rejectPayoutAction } from '@/lib/actions/payout-confirmation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { CANCEL_REASON_MAX_LENGTH, CANCEL_REASON_MIN_LENGTH } from '@/lib/schemas/transfer'
import { formatPLN } from '@/lib/utils/format-currency'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  transactionId: number
  amount: number
  onClose: () => void
}

export function RejectPayoutDialog({ transactionId, amount, onClose }: PropsT) {
  const { locale, t } = useTranslation('workerPage')
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)
  const trimmedReason = reason.trim()
  const isReasonValid = trimmedReason.length >= CANCEL_REASON_MIN_LENGTH

  async function handleReject() {
    if (!isReasonValid) return
    setIsPending(true)
    const result = await settleAction(() =>
      rejectPayoutAction(transactionId, { reason: trimmedReason }),
    )
    setIsPending(false)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return
    }
    toastMessage(t('payoutRejected'), 'success')
    onClose()
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="sm:h-fit sm:max-w-md">
        <DialogHeader
          title={t('payoutRejectTitle', { amount: formatPLN(amount) })}
          description={t('payoutRejectDescription')}
        />
        <ReasonField
          id={`payout-reject-reason-${transactionId}`}
          value={reason}
          onChange={setReason}
          min={CANCEL_REASON_MIN_LENGTH}
          max={CANCEL_REASON_MAX_LENGTH}
          label={t('payoutRejectReason')}
          placeholder={t('payoutRejectPlaceholder')}
          counterText={({ length, missing }) =>
            missing === 0
              ? t('payoutReasonCount', { length, max: CANCEL_REASON_MAX_LENGTH })
              : t('payoutReasonMissing', { missing })
          }
          disabled={isPending}
        />
        <DialogActions
          confirmLabel={t('payoutReject')}
          confirmVariant="destructive"
          pending={isPending}
          confirmDisabled={!isReasonValid}
          onConfirm={handleReject}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
