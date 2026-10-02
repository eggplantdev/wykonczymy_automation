'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { updateInvestmentAction } from '@/lib/actions/investments'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { requestReviewFormId } from '@/components/dialogs/request-review-dialog'
import type { InvestmentRefT } from '@/types/reference-data'

type EditInvestmentDialogPropsT = {
  investment: InvestmentRefT
  showLabel?: boolean
}

export function EditInvestmentDialog({ investment, showLabel }: EditInvestmentDialogPropsT) {
  const formId = `edit-investment-${investment.id}`
  const openDialog = useOptimisticFormStore((s) => s.openDialog)

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
          // Opens the instance the listing row / investment page mounts once the refresh shows the
          // investment as „Zakończona" — the store keeps the id until that dialog renders.
          onEnteredCompleted={() => openDialog(requestReviewFormId(investment.id), false)}
        />
      )}
    </FormDialog>
  )
}
