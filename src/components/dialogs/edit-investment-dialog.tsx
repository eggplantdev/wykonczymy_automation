'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { updateInvestmentAction } from '@/lib/actions/investments'
import { useReviewPromptStore } from '@/stores/review-prompt-store'
import { toBillingFormValues } from '@/components/forms/investment-form/billing-form-values'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

type EditInvestmentDialogPropsT = {
  investment: Pick<
    InvestmentWithDetailsT,
    | 'id'
    | 'name'
    | 'address'
    | 'postalCode'
    | 'city'
    | 'country'
    | 'phone'
    | 'email'
    | 'contactPerson'
    | 'billing'
    | 'notes'
    | 'reviewRequested'
    | 'status'
  >
  showLabel?: boolean
  triggerText?: string
}

export function EditInvestmentDialog({
  investment,
  showLabel,
  triggerText,
}: EditInvestmentDialogPropsT) {
  const formId = `edit-investment-${investment.id}`
  const openReviewPrompt = useReviewPromptStore((s) => s.openReviewPrompt)

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      className="sm:max-w-dialog-md"
      trigger={
        <EditButton
          label="Edytuj inwestycję"
          text={triggerText}
          showLabel={showLabel || triggerText !== undefined}
        />
      }
      title="Edytuj inwestycję"
      description={investment.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <InvestmentForm
          formId={formId}
          defaultValues={{
            name: investment.name,
            address: investment.address,
            postalCode: investment.postalCode,
            city: investment.city,
            country: investment.country,
            phone: investment.phone,
            email: investment.email,
            contactPerson: investment.contactPerson,
            billing: toBillingFormValues(investment.billing),
            notes: investment.notes,
            reviewRequested: investment.reviewRequested,
            status: investment.status,
            presetId: '',
          }}
          action={(data) => updateInvestmentAction(investment.id, data)}
          successMessage="Inwestycja zaktualizowana"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
          assetsInvestmentId={investment.id}
          onEnteredCompleted={(data) =>
            openReviewPrompt({
              id: investment.id,
              name: data.name,
              email: data.email ?? '',
              reviewRequested: false,
            })
          }
        />
      )}
    </FormDialog>
  )
}
