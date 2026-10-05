'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { deleteExpenseDraftAction } from '@/lib/actions/worker-expense-drafts'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'

type PropsT = {
  draftId: number
  investmentName: string
}

export function DeleteExpenseDraftButton({ draftId, investmentName }: PropsT) {
  const router = useRouter()
  const { locale, t } = useTranslation('expenseDrafts')
  const [isConfirming, setIsConfirming] = useState(false)

  async function handleDelete() {
    const result = await settleAction(() => deleteExpenseDraftAction(draftId))
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return
    }
    toastMessage(t('deletedToast'))
    router.refresh()
  }

  return (
    <>
      <DeleteButton onClick={() => setIsConfirming(true)} />
      <ConfirmDialog
        open={isConfirming}
        title={t('deleteTitle')}
        description={investmentName}
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirming(false)}
      />
    </>
  )
}
