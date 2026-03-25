'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { EditInvestmentForm } from '@/components/forms/investment-form/edit-investment-form'
import type { InvestmentRefT } from '@/types/reference-data'

type EditInvestmentDialogPropsT = {
  investment: InvestmentRefT
}

export function EditInvestmentDialog({ investment }: EditInvestmentDialogPropsT) {
  return (
    <FormDialog
      formId={`edit-investment-${investment.id}`}
      showKeepOpen={false}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edytuj inwestycję">
          <Pencil className="h-4 w-4" />
        </Button>
      }
      title="Edytuj inwestycję"
      description={investment.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <EditInvestmentForm
          investment={investment}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
