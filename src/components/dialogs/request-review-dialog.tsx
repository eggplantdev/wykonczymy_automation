'use client'

import { FormDialog } from '@/components/ui/form-dialog'
import { RequestReviewForm } from '@/components/forms/request-review-form/request-review-form'
import type { ReviewRequestInvestmentT } from '@/types/reference-data'

type RequestReviewDialogPropsT = {
  investment: ReviewRequestInvestmentT
  trigger: React.ReactNode
  formId?: string
}

export function RequestReviewDialog({
  investment,
  trigger,
  formId = `request-review-${investment.id}`,
}: RequestReviewDialogPropsT) {
  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={trigger}
      title="Poproś o opinię"
      description={`${investment.name} — klient dostanie wiadomość z linkiem do opinii w Google.`}
    >
      {(onSubmitSuccess) => (
        <RequestReviewForm
          formId={formId}
          investmentId={investment.id}
          email={investment.email}
          onSubmitSuccess={onSubmitSuccess}
        />
      )}
    </FormDialog>
  )
}
