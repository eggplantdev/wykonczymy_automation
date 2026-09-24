'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { rateFormValues } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { updateCatalogueItemAction } from '@/lib/actions/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type EditCatalogueItemDialogPropsT = {
  item: WorkCatalogueItemT
  categorySuggestions: readonly string[]
}

export function EditCatalogueItemDialog({
  item,
  categorySuggestions,
}: EditCatalogueItemDialogPropsT) {
  const formId = `edit-catalogue-item-${item.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={<EditButton label="Edytuj pozycję katalogu" />}
      title="Edytuj pozycję katalogu"
      description={item.description}
    >
      {(onSubmitSuccess, keepOpen) => (
        <WorkCatalogueItemForm
          formId={formId}
          defaultValues={{
            description: item.description,
            category: item.category ?? '',
            unit: item.unit,
            clientPrice: String(item.clientPrice),
            ...rateFormValues(item),
          }}
          categorySuggestions={categorySuggestions}
          action={(data) => updateCatalogueItemAction(item.id, data)}
          successMessage="Pozycja zaktualizowana"
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
