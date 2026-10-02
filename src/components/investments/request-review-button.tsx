'use client'

import { Star } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { RequestReviewDialog } from '@/components/dialogs/request-review-dialog'
import type { ReviewRequestInvestmentT } from '@/types/reference-data'

type RequestReviewButtonPropsT = {
  investment: ReviewRequestInvestmentT
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
