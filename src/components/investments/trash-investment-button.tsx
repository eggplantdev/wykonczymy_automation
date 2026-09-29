'use client'

import { useState, startTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { trashInvestmentAction } from '@/lib/actions/investment-trash'
import { toastMessage } from '@/lib/utils/toast'

export function TrashInvestmentButton({
  investment,
}: {
  investment: { id: number; name: string }
}) {
  const [confirming, setConfirming] = useState(false)

  const onConfirm = () => {
    startTransition(async () => {
      const res = await trashInvestmentAction(investment.id)
      setConfirming(false)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć inwestycji', 'error')
      toastMessage('Inwestycja przeniesiona do kosza.', 'success')
    })
  }

  return (
    <>
      <DeleteButton label="Usuń inwestycję" onClick={() => setConfirming(true)} />
      <ConfirmDialog
        open={confirming}
        title="Przenieść do kosza?"
        description={`Przenieść „${investment.name}" do kosza? Możesz ją przywrócić z Kosza.`}
        confirmLabel="Przenieś do kosza"
        variant="neutral"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
