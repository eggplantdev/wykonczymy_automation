'use client'

import { FormDialog } from '@/components/ui/form-dialog'
import { RequestReviewForm } from '@/components/forms/request-review-form/request-review-form'
import type { InvestmentRefT } from '@/types/reference-data'

type RequestReviewDialogPropsT = {
  investment: Pick<InvestmentRefT, 'id' | 'name' | 'email' | 'reviewRequested'>
  trigger: React.ReactNode
}

/** Shared with `EditInvestmentDialog`, which opens a mounted instance by this id after a save. */
export const requestReviewFormId = (investmentId: number) => `request-review-${investmentId}`

export function RequestReviewDialog({ investment, trigger }: RequestReviewDialogPropsT) {
  const formId = requestReviewFormId(investment.id)

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={trigger}
      title="Poproś o opinię"
      description={
        investment.reviewRequested
          ? `${investment.name} — prośba została już wysłana. Wysłać ponownie?`
          : `${investment.name} — klient dostanie wiadomość z linkiem do opinii w Google.`
      }
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
