'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
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
  disabledReason?: string
}

export function CancelTransferButton({
  transactionId,
  disabledReason,
}: CancelTransferButtonPropsT) {
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

  if (disabledReason) {
    return (
      <RowActionButton
        icon={Ban}
        label="Anuluj transakcję"
        text="Anuluj"
        tone="destructive"
        tooltip={disabledReason}
        disabled
      />
    )
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

      <FormDialogShell
        open={open}
        onOpenChange={handleOpenChange}
        showCloseButton={false}
        title="Anulowanie transakcji"
        description={`Czy na pewno chcesz anulować transakcję #${transactionId}? Operacja jest nieodwracalna.`}
        cancelLabel="Nie"
        confirmLabel="Tak, anuluj"
        confirmVariant="destructive"
        pending={isPending}
        pendingLabel="Anulowanie..."
        confirmDisabled={!isReasonValid}
        onConfirm={handleConfirm}
      >
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
      </FormDialogShell>
    </>
  )
}
