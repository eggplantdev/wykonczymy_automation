'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { ReasonField } from '@/components/ui/reason-field'
import { cancelTransferAction } from '@/lib/actions/transfers'
import {
  CANCEL_REASON_MAX_LENGTH as REASON_MAX_LENGTH,
  CANCEL_REASON_MIN_LENGTH as REASON_MIN_LENGTH,
} from '@/lib/schemas/transfer'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type CancelTransferButtonPropsT = {
  transactionId: number
}

export function CancelTransferButton({ transactionId }: CancelTransferButtonPropsT) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setIsPending] = useState(false)

  const trimmedReason = reason.trim()
  const isReasonValid = trimmedReason.length >= REASON_MIN_LENGTH

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setReason('')
  }

  async function handleConfirm() {
    if (!isReasonValid) return
    setIsPending(true)
    const result = await settleAction(() =>
      cancelTransferAction(transactionId, { reason: trimmedReason }),
    )
    setIsPending(false)

    if (result.success) {
      toastMessage('Transakcja została anulowana', 'success')
      handleOpenChange(false)
    } else {
      toastMessage(result.error, 'error')
    }
  }

  return (
    <>
      <RowActionButton
        icon={Ban}
        label="Anuluj transakcję"
        text="Anuluj"
        tone="destructive"
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="sm:h-fit sm:max-w-md">
          <DialogHeader
            title="Anulowanie transakcji"
            description={`Czy na pewno chcesz anulować transakcję #${transactionId}? Operacja jest nieodwracalna.`}
          />

          <ReasonField
            id="cancel-reason"
            value={reason}
            onChange={setReason}
            min={REASON_MIN_LENGTH}
            max={REASON_MAX_LENGTH}
            label="Powód anulowania (wymagany)"
            placeholder={`Min. ${REASON_MIN_LENGTH} znaków`}
            counterText={({ length, missing }) =>
              missing === 0 ? `${length}/${REASON_MAX_LENGTH} znaków` : `Brakuje ${missing} znaków`
            }
            disabled={isPending}
          />

          <DialogActions
            cancelLabel="Nie"
            confirmLabel="Tak, anuluj"
            confirmVariant="destructive"
            pending={isPending}
            pendingLabel="Anulowanie..."
            confirmDisabled={!isReasonValid}
            onConfirm={handleConfirm}
            onCancel={() => handleOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
