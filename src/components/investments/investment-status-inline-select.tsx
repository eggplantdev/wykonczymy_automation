'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { InvestmentStatusSelect } from '@/components/investments/investment-status-select'
import { setInvestmentStatusAction } from '@/lib/actions/investments'
import { COMPLETE_INVESTMENT_CONFIRM, entersLockedStatus } from '@/lib/constants/investment-lock'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useReviewPromptStore } from '@/stores/review-prompt-store'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

type PropsT = {
  investment: Pick<InvestmentWithDetailsT, 'id' | 'name' | 'email' | 'status' | 'reviewRequested'>
  hideChevron?: boolean
}

export function InvestmentStatusInlineSelect({ investment, hideChevron }: PropsT) {
  const [status, setStatus] = useOptimistic(investment.status)
  const [isPending, startTransition] = useTransition()
  const [pendingCompletion, setPendingCompletion] = useState<InvestmentStatusT>()
  const openReviewPrompt = useReviewPromptStore((s) => s.openReviewPrompt)

  function save(next: InvestmentStatusT, entersCompleted: boolean) {
    startTransition(async () => {
      setStatus(next)
      const result = await settleAction(() => setInvestmentStatusAction(investment.id, next))
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      if (entersCompleted && !investment.reviewRequested)
        openReviewPrompt({
          id: investment.id,
          name: investment.name,
          email: investment.email,
          reviewRequested: false,
        })
    })
  }

  function handleChange(next: InvestmentStatusT) {
    if (entersLockedStatus(investment.status, next)) setPendingCompletion(next)
    else save(next, false)
  }

  return (
    <>
      <InvestmentStatusSelect
        value={status}
        onValueChange={handleChange}
        disabled={isPending}
        hideChevron={hideChevron}
      />
      <ConfirmDialog
        open={pendingCompletion !== undefined}
        {...COMPLETE_INVESTMENT_CONFIRM}
        onConfirm={() => {
          if (pendingCompletion) save(pendingCompletion, true)
          setPendingCompletion(undefined)
        }}
        onCancel={() => setPendingCompletion(undefined)}
      />
    </>
  )
}
