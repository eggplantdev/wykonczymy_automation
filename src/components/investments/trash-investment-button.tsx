'use client'

import { useState, startTransition, useTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { trashInvestmentAction } from '@/lib/actions/investment-trash'
import { KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'
import { getInvestmentKosztorysUsed } from '@/lib/queries/investment-kosztorys-used'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

const FAILED_MESSAGE = 'Nie udało się usunąć inwestycji'

export function TrashInvestmentButton({
  investment,
}: {
  investment: { id: number; name: string }
}) {
  const [confirming, setConfirming] = useState(false)
  const [kosztorysUsed, setKosztorysUsed] = useState(false)
  const [checking, startChecking] = useTransition()

  const onClick = () => {
    startChecking(async () => {
      try {
        setKosztorysUsed(await getInvestmentKosztorysUsed(investment.id))
        setConfirming(true)
      } catch {
        toastMessage(FAILED_MESSAGE, 'error')
      }
    })
  }

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => trashInvestmentAction(investment.id))
      setConfirming(false)
      if (!res.success) return toastMessage(res.error ?? FAILED_MESSAGE, 'error')
      toastMessage('Inwestycja przeniesiona do kosza.', 'success')
    })
  }

  const question = `Przenieść „${investment.name}" do kosza? Możesz ją przywrócić z Kosza.`

  return (
    <>
      <DeleteButton label="Usuń inwestycję" disabled={checking} onClick={onClick} />
      <ConfirmDialog
        open={confirming}
        title="Przenieść do kosza?"
        description={kosztorysUsed ? `${KOSZTORYS_IN_USE_WARNING} ${question}` : question}
        confirmLabel="Przenieś do kosza"
        variant={kosztorysUsed ? 'alert' : 'neutral'}
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
