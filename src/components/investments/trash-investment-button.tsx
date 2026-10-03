'use client'

import { useState, startTransition, useTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { trashInvestmentAction } from '@/lib/actions/investment-trash'
import {
  ACTIVE_INVESTMENT_DELETE_MESSAGE,
  isUndeletableStatus,
  KOSZTORYS_IN_USE_WARNING,
} from '@/lib/constants/trash'
import { getInvestmentKosztorysUsed } from '@/lib/queries/investment-kosztorys-used'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

export function TrashInvestmentButton({
  investment,
}: {
  investment: { id: number; name: string; status: string; hasKosztorys: boolean }
}) {
  const [asking, setAsking] = useState<{ kosztorysUsed: boolean } | null>(null)
  const [checking, startChecking] = useTransition()

  const onClick = () => {
    if (isUndeletableStatus(investment.status)) {
      return toastMessage(ACTIVE_INVESTMENT_DELETE_MESSAGE, 'error')
    }
    if (!investment.hasKosztorys) return setAsking({ kosztorysUsed: false })
    startChecking(async () => {
      const res = await settleAction(() => getInvestmentKosztorysUsed(investment.id))
      if (!res.success) return toastMessage(res.error, 'error')
      setAsking({ kosztorysUsed: res.data })
    })
  }

  const onConfirm = () => {
    startTransition(async () => {
      const res = await settleAction(() => trashInvestmentAction(investment.id))
      setAsking(null)
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage('Inwestycja przeniesiona do kosza.', 'success')
    })
  }

  const question = `Przenieść „${investment.name}" do kosza? Możesz ją przywrócić z Kosza.`

  return (
    <>
      <DeleteButton label="Usuń inwestycję" disabled={checking} onClick={onClick} />
      <ConfirmDialog
        open={asking !== null}
        title="Przenieść do kosza?"
        description={asking?.kosztorysUsed ? `${KOSZTORYS_IN_USE_WARNING} ${question}` : question}
        confirmLabel="Przenieś do kosza"
        variant={asking?.kosztorysUsed ? 'alert' : 'neutral'}
        onConfirm={onConfirm}
        onCancel={() => setAsking(null)}
      />
    </>
  )
}
