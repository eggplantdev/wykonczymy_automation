'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { createCatalogueItemAction } from '@/lib/actions/work-catalogue'
import type { WorkCatalogueItemFormValuesT } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

const EMPTY_DEFAULTS: WorkCatalogueItemFormValuesT = {
  description: '',
  category: '',
  unit: '',
  clientPrice: '',
  wToolsSource: 'auto',
  wToolsRate: '',
  wToolsCoeff: '',
  ownToolsSource: 'auto',
  ownToolsRate: '',
  ownToolsCoeff: '',
}

export function AddCatalogueItemDialog({
  categorySuggestions,
}: {
  categorySuggestions: readonly string[]
}) {
  return (
    <FormDialog
      formId="add-catalogue-item"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Nowa praca
        </Button>
      }
      title="Nowa praca w katalogu"
    >
      {(onSubmitSuccess, keepOpen) => (
        <WorkCatalogueItemForm
          formId="add-catalogue-item"
          defaultValues={EMPTY_DEFAULTS}
          categorySuggestions={categorySuggestions}
          action={createCatalogueItemAction}
          successMessage="Praca dodana do katalogu"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
