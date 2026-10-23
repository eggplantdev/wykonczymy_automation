'use client'

import { Description } from '@/components/ui/description'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { rateFormValues } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { updateCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { translationTexts } from '@/lib/i18n/description-translations'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type EditCatalogueItemDialogPropsT = {
  item: WorkCatalogueItemT
  categorySuggestions: readonly string[]
  templateNames: readonly string[]
}

export function EditCatalogueItemDialog({
  item,
  categorySuggestions,
  templateNames,
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
        <>
          {templateNames.length > 0 && (
            <Description tone="warning" withIcon={false}>
              Ta praca jest w szablonach: {templateNames.join(', ')}. Zmiana trafi do każdego z
              nich.
            </Description>
          )}
          <WorkCatalogueItemForm
            formId={formId}
            defaultValues={{
              description: item.description,
              category: item.category ?? '',
              unit: item.unit,
              clientPrice: String(item.clientPrice),
              ...rateFormValues(item),
              translations: translationTexts(item.descriptionTranslations),
              workNote: item.workNote ?? '',
            }}
            translationBaseline={item.descriptionTranslations}
            categorySuggestions={categorySuggestions}
            action={(data) => updateCatalogueItemAction(item.id, data)}
            successMessage="Pozycja zaktualizowana"
            submitLabel="Zapisz"
            submittingLabel="Zapisywanie..."
            onSubmitSuccess={onSubmitSuccess}
            keepOpen={keepOpen}
            persistDraft={false}
          />
        </>
      )}
    </FormDialog>
  )
}
