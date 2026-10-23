'use client'

import { AiTranslateCheckbox } from '@/components/forms/form-components/ai-translate-checkbox'
import { useAiTranslate } from '@/components/forms/hooks/use-ai-translate'
import { AddButton } from '@/components/ui/add-button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { createCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { EMPTY_CATALOGUE_ITEM_VALUES } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

export function AddCatalogueItemDialog({
  categorySuggestions,
}: {
  categorySuggestions: readonly string[]
}) {
  const [translate, setTranslate] = useAiTranslate()
  return (
    <FormDialog
      formId="add-catalogue-item"
      trigger={<AddButton>Nowa praca</AddButton>}
      title="Nowa praca w katalogu"
    >
      {(onSubmitSuccess, keepOpen) => (
        <WorkCatalogueItemForm
          formId="add-catalogue-item"
          defaultValues={EMPTY_CATALOGUE_ITEM_VALUES}
          categorySuggestions={categorySuggestions}
          action={(data) => createCatalogueItemAction(data, translate)}
          successMessage="Praca dodana do katalogu"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        >
          <AiTranslateCheckbox checked={translate} onCheckedChange={setTranslate} />
        </WorkCatalogueItemForm>
      )}
    </FormDialog>
  )
}
