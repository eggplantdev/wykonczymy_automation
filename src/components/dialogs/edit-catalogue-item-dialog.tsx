'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { rateFormValues } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { useCatalogueItemTemplates } from '@/hooks/use-catalogue-item-templates'
import { updateCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { translationTexts } from '@/lib/i18n/description-translations'
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
  const { templateNames, loadTemplateNames } = useCatalogueItemTemplates(item.id)

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={
        <span className="contents" onClick={loadTemplateNames}>
          <EditButton label="Edytuj pozycję katalogu" />
        </span>
      }
      title="Edytuj pozycję katalogu"
      description={item.description}
    >
      {(onSubmitSuccess, keepOpen) => (
        <>
          {/* A szablon shows its prace straight from the katalog (EX-1017), so this save changes
              them too — said before the save, not discovered after. */}
          {templateNames.length > 0 && (
            <p className="mb-4 text-sm text-amber-600">
              Ta praca jest w szablonach: {templateNames.join(', ')}. Zmiana trafi do każdego z
              nich.
            </p>
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
