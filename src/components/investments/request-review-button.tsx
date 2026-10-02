'use client'

import { Star } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { RequestReviewDialog } from '@/components/dialogs/request-review-dialog'
import type { InvestmentRefT } from '@/types/reference-data'

type RequestReviewButtonPropsT = {
  investment: Pick<InvestmentRefT, 'id' | 'name' | 'email' | 'reviewRequested'>
  showLabel?: boolean
}

export function RequestReviewButton({ investment, showLabel }: RequestReviewButtonPropsT) {
  const label = investment.reviewRequested ? 'Wyślij ponownie prośbę o opinię' : 'Poproś o opinię'

  return (
    <RequestReviewDialog
      investment={investment}
      trigger={<RowActionButton icon={Star} label={label} showLabel={showLabel} />}
    />
  )
}
