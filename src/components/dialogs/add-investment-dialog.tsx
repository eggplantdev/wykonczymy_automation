'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { createInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'
import type { PresetMetaT } from '@/lib/db/presets'

const EMPTY_DEFAULTS: InvestmentFormValuesT = {
  name: '',
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  status: 'active',
  presetId: '',
}

export function AddInvestmentDialog({ presets }: { presets: PresetMetaT[] }) {
  return (
    <FormDialog
      formId="add-investment"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
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
          presetOptions={presets}
        />
      )}
    </FormDialog>
  )
}
