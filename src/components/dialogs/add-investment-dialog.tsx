'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { AddInvestmentForm } from '@/components/forms/investment-form/add-investment-form'

export function AddInvestmentDialog() {
  return (
    <FormDialog
      formId="add-investment"
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Dodaj
        </Button>
      }
      title="Nowa inwestycja"
    >
      {(onSubmitSuccess, keepOpen) => (
        <AddInvestmentForm onSubmitSuccess={onSubmitSuccess} keepOpen={keepOpen} />
      )}
    </FormDialog>
  )
}
