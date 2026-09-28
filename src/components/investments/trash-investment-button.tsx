'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { trashInvestmentAction } from '@/lib/actions/investment-trash'
import { toastMessage } from '@/lib/utils/toast'

export function TrashInvestmentButton({ investment }: { investment: { id: number; name: string } }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const onConfirm = () => {
    startTransition(async () => {
      const res = await trashInvestmentAction(investment.id)
      setConfirming(false)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć inwestycji', 'error')
      toastMessage('Inwestycja przeniesiona do kosza.', 'success')
      router.refresh()
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
        pending={pending}
        pendingLabel="Przenoszę…"
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
