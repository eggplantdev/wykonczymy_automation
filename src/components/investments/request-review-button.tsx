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
  // One request per client: a resend would only nag. Unticking „Prośba o opinię wysłana" in the edit
  // form is the deliberate way back.
  if (investment.reviewRequested) return null

  return (
    <RequestReviewDialog
      investment={investment}
      trigger={<RowActionButton icon={Star} label="Poproś o opinię" showLabel={showLabel} />}
    />
  )
}
