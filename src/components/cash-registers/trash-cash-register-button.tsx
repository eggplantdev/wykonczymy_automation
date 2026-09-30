'use client'

import { useState, startTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { trashCashRegisterAction } from '@/lib/actions/cash-register-trash'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

// Never pre-disabled for a used kasa: the refusal names the transaction count, which a disabled
// button could not say.
export function TrashCashRegisterButton({
  cashRegister,
}: {
  cashRegister: { id: number; name: string }
}) {
  const [confirming, setConfirming] = useState(false)

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => trashCashRegisterAction(cashRegister.id))
      setConfirming(false)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć kasy', 'error')
      toastMessage('Kasa przeniesiona do kosza.', 'success')
    })
  }

  return (
    <>
      <DeleteButton label="Usuń kasę" onClick={() => setConfirming(true)} />
      <ConfirmDialog
        open={confirming}
        title="Przenieść do kosza?"
        description={`Przenieść „${cashRegister.name}" do kosza? Możesz ją przywrócić z Kosza.`}
        confirmLabel="Przenieś do kosza"
        variant="neutral"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
