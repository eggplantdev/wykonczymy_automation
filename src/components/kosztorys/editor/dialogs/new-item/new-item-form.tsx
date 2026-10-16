'use client'

import { useRef, useState } from 'react'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { AiTranslateCheckbox } from '@/components/forms/form-components/ai-translate-checkbox'
import { useAiTranslate } from '@/components/forms/hooks/use-ai-translate'
import { RateField } from '@/components/forms/work-catalogue-item/rate-fields'
import { catalogueFigures } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import type { AddItemInputT } from '@/lib/actions/kosztorys'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { PRICE_SOURCE_LABELS } from '@/lib/kosztorys/labels'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { catalogueCategorySuggestions } from '@/lib/kosztorys/work-catalogue/category-options'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { unitOptions } from '@/lib/kosztorys/unit-options'
import { useNewItemFormStore } from '@/stores/form-stores'
import type { ActionResultT } from '@/types/action'
import { CatalogueCollisionConfirm, type CollisionChoiceT } from './catalogue-collision-confirm'
import { newItemDefaults, newItemFormSchema, type NewItemFormValuesT } from './new-item-form-schema'

export type NewItemPayloadT = Omit<AddItemInputT, 'placement'>

const SOURCE_OPTION_LABELS: Record<PriceSourceT, string> = {
  ...PRICE_SOURCE_LABELS,
  auto: 'auto — ze współczynnika tej inwestycji',
}

const CATALOGUE_ONLY_NOTE =
  'Zapisuje się w katalogu prac — zaznacz niżej „Dodaj pracę do katalogu prac”.'

export function NewItemForm({
  formId,
  sectionName,
  initialValues,
  workCatalogue,
  isTemplate,
  kosztorysUnits,
  keepOpen,
  action,
  onSubmitSuccess,
}: {
  formId: string
  sectionName: string
  initialValues?: Partial<NewItemFormValuesT>
  workCatalogue: readonly WorkCatalogueItemT[]
  isTemplate: boolean
  kosztorysUnits: readonly string[]
  keepOpen: boolean
  action: (payload: NewItemPayloadT) => Promise<ActionResultT>
  onSubmitSuccess: () => void
}) {
  const catalogueWrite = useRef<NewItemPayloadT['catalogue']>(null)
  const [translate, setTranslate] = useAiTranslate()
  const [collision, setCollision] = useState<{
    existing: WorkCatalogueItemT
    candidate: ReturnType<typeof catalogueFigures> & { category: string }
    answer: (choice: CollisionChoiceT) => void
  } | null>(null)

  const { form, reset } = useManagedForm<NewItemFormValuesT, NewItemPayloadT>({
    formId,
    useFormStore: useNewItemFormStore,
    schema: newItemFormSchema,
    defaultValues: { ...newItemDefaults(sectionName), ...initialValues },
    keepOpen,
    successMessage: 'Dodano pracę',
    onSubmitSuccess,
    action,
    persistDraft: false,
    beforeSubmit: async (value) => {
      catalogueWrite.current = null
      if (!value.addToCatalogue) return true

      const key = catalogueKey(value.description, value.unit)
      const existing = workCatalogue.find((entry) => entry.matchKey === key)
      if (!existing) {
        catalogueWrite.current = { mode: 'new', keepCatalogueCategory: true }
        return true
      }

      const choice = await new Promise<CollisionChoiceT>((answer) =>
        setCollision({
          existing,
          candidate: { ...catalogueFigures(value), category: value.category },
          answer,
        }),
      )
      setCollision(null)
      if (choice.kind === 'back') return false
      if (choice.kind === 'overwrite') {
        catalogueWrite.current = {
          mode: 'overwrite',
          keepCatalogueCategory: choice.keepCatalogueCategory,
        }
      }
      return true
    },
    toData: (value) => ({
      data: {
        description: value.description,
        category: value.addToCatalogue ? value.category : '',
        unit: value.unit,
        ...catalogueFigures(value),
      },
      catalogue: catalogueWrite.current && {
        ...catalogueWrite.current,
        workNote: value.workNote,
      },
      translate,
    }),
  })

  const addToCatalogue = useFieldValue<boolean>(form, 'addToCatalogue')
  const unit = useFieldValue<string>(form, 'unit') ?? ''

  return (
    <>
      <FormShell form={form} onReset={reset}>
        <FieldGroup>
          <form.AppField name="description">
            {(field) => (
              <field.Textarea label="Opis pracy" rows={2} placeholder="Malowanie ścian" showError />
            )}
          </form.AppField>
          <AiTranslateCheckbox checked={translate} onCheckedChange={setTranslate} />
          <form.AppField name="workNote">
            {(field) => (
              <field.Textarea
                label={COLUMN_LABELS.workNote}
                rows={3}
                disabled={!addToCatalogue}
                description={addToCatalogue ? undefined : CATALOGUE_ONLY_NOTE}
              />
            )}
          </form.AppField>

          <form.AppField name="unit">
            {(field) => (
              <field.CreatableCombobox label="j.m." options={unitOptions(kosztorysUnits, unit)} />
            )}
          </form.AppField>

          <form.AppField name="clientPrice">
            {(field) => (
              <field.Input label="Cena j.m. (PLN)" type="number" placeholder="0.00" showError />
            )}
          </form.AppField>

          <RateField form={form} plane="wTools" sourceLabels={SOURCE_OPTION_LABELS} />
          <RateField form={form} plane="ownTools" sourceLabels={SOURCE_OPTION_LABELS} />

          <form.AppField name="category">
            {(field) => (
              <field.CreatableCombobox
                label="Kategoria"
                options={catalogueCategorySuggestions(workCatalogue)}
                disabled={!addToCatalogue}
                description={addToCatalogue ? undefined : CATALOGUE_ONLY_NOTE}
              />
            )}
          </form.AppField>
          {!isTemplate && (
            <form.AppField name="addToCatalogue">
              {(field) => <field.Checkbox label="Dodaj pracę do katalogu prac" />}
            </form.AppField>
          )}
        </FieldGroup>

        <FormFooter
          label="Dodaj"
          submittingLabel="Zapisywanie..."
          className="mt-6"
          awaitingAnswer={collision !== null}
        />
      </FormShell>

      {collision && (
        <CatalogueCollisionConfirm
          existing={collision.existing}
          candidate={collision.candidate}
          allowKosztorysOnly={!isTemplate}
          onChoose={collision.answer}
        />
      )}
    </>
  )
}
