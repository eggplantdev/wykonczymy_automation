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
  if (investment.reviewRequested) return null

  return (
    <RequestReviewDialog
      investment={investment}
      trigger={<RowActionButton icon={Star} label="Poproś o opinię" showLabel={showLabel} />}
    />
  )
}
