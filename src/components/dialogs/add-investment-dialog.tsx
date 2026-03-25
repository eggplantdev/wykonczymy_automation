'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { createInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'

const EMPTY_DEFAULTS: InvestmentFormValuesT = {
  name: '',
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  status: 'active',
}

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
        <InvestmentForm
          formId="add-investment"
          defaultValues={EMPTY_DEFAULTS}
          action={createInvestmentAction}
          successMessage="Inwestycja dodana"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
