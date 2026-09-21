'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { updateInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentRefT } from '@/types/reference-data'

type EditInvestmentDialogPropsT = {
  investment: InvestmentRefT
  showLabel?: boolean
}

export function EditInvestmentDialog({ investment, showLabel }: EditInvestmentDialogPropsT) {
  const formId = `edit-investment-${investment.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={<EditButton label="Edytuj inwestycję" showLabel={showLabel} />}
      title="Edytuj inwestycję"
      description={investment.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <InvestmentForm
          formId={formId}
          defaultValues={{
            name: investment.name,
            address: investment.address,
            phone: investment.phone,
            email: investment.email,
            contactPerson: investment.contactPerson,
            notes: investment.notes,
            review: investment.review,
            status: investment.status,
            presetId: '',
            // `updateInvestmentAction` strips the field; see `collectAssets`.
          }}
          action={(data) => updateInvestmentAction(investment.id, data)}
          successMessage="Inwestycja zaktualizowana"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
        />
      )}
    </FormDialog>
  )
}
