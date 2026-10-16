'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { createInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'
import type { TemplateMetaT } from '@/lib/db/templates'
import { toBillingFormValues } from '@/components/forms/investment-form/billing-form-values'
import { NO_INVESTMENT_BILLING } from '@/lib/investments/investment-details'

const EMPTY_DEFAULTS: InvestmentFormValuesT = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  contactPerson: '',
  billing: toBillingFormValues(NO_INVESTMENT_BILLING),
  notes: '',
  reviewRequested: false,
  status: 'quote',
  presetId: '',
}

export function AddInvestmentDialog({ presets }: { presets: TemplateMetaT[] }) {
  return (
    <FormDialog
      formId="add-investment"
      className="sm:max-w-dialog-md"
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
          collectAssets
        />
      )}
    </FormDialog>
  )
}
