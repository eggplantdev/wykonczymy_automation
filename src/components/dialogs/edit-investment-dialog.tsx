'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { updateInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentRefT } from '@/types/reference-data'

type EditInvestmentDialogPropsT = {
  investment: InvestmentRefT
}

export function EditInvestmentDialog({ investment }: EditInvestmentDialogPropsT) {
  const formId = `edit-investment-${investment.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={
        <Button size="sm" variant="outline" aria-label="Edytuj inwestycję">
          <Pencil className="size-4" />
          <span>Edytuj inwestycję</span>
        </Button>
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
            phone: investment.phone,
            email: investment.email,
            contactPerson: investment.contactPerson,
            notes: investment.notes,
            review: investment.review,
            status: investment.status,
          }}
          action={(data) => updateInvestmentAction(investment.id, data)}
          successMessage="Inwestycja zaktualizowana"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
