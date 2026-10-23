'use client'

import { AddButton } from '@/components/ui/add-button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { createInvestmentAction } from '@/lib/actions/investments'
import type { TemplateMetaT } from '@/lib/db/templates'
import { EMPTY_INVESTMENT_FORM_VALUES } from '@/components/forms/investment-form/empty-form-values'

export function AddInvestmentDialog({ presets }: { presets: TemplateMetaT[] }) {
  return (
    <FormDialog
      formId="add-investment"
      className="sm:max-w-dialog-md"
      trigger={<AddButton>Dodaj</AddButton>}
      title="Nowa inwestycja"
    >
      {(onSubmitSuccess, keepOpen) => (
        <InvestmentForm
          formId="add-investment"
          defaultValues={EMPTY_INVESTMENT_FORM_VALUES}
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
