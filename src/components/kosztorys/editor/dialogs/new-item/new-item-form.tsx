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
import { CreatableComboboxField } from '@/components/forms/work-catalogue-item/creatable-combobox-field'
import { catalogueFigures } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import type { AddItemInputT } from '@/lib/actions/kosztorys'
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

export function NewItemForm({
  formId,
  sectionName,
  workCatalogue,
  kosztorysUnits,
  keepOpen,
  action,
  onSubmitSuccess,
}: {
  formId: string
  sectionName: string
  workCatalogue: readonly WorkCatalogueItemT[]
  kosztorysUnits: readonly string[]
  keepOpen: boolean
  action: (payload: NewItemPayloadT) => Promise<ActionResultT>
  onSubmitSuccess: () => void
}) {
  // What the collision question decided, read by `toData` on the same submit. Set on every submit
  // before it is read, so a previous praca's answer never leaks into the next one.
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
    defaultValues: newItemDefaults(sectionName),
    keepOpen,
    successMessage: 'Dodano pracę',
    onSubmitSuccess,
    action,
    // The dialog has to see the created praca before it closes, to place it in the grid.
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
    // A hidden kategoria still sits in the values (lessons.md: a hidden field still ships), so the
    // checkbox — not the field's visibility — decides whether it travels.
    toData: (value) => ({
      data: {
        description: value.description,
        category: value.addToCatalogue ? value.category : '',
        unit: value.unit,
        ...catalogueFigures(value),
      },
      catalogue: catalogueWrite.current,
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

          <form.AppField name="unit">
            {() => (
              <CreatableComboboxField label="j.m." options={unitOptions(kosztorysUnits, unit)} />
            )}
          </form.AppField>

          <form.AppField name="clientPrice">
            {(field) => (
              <field.Input label="Cena j.m. (PLN)" type="number" placeholder="0.00" showError />
            )}
          </form.AppField>

          <RateField form={form} plane="wTools" sourceLabels={SOURCE_OPTION_LABELS} />
          <RateField form={form} plane="ownTools" sourceLabels={SOURCE_OPTION_LABELS} />

          <AiTranslateCheckbox checked={translate} onCheckedChange={setTranslate} />

          <form.AppField name="addToCatalogue">
            {(field) => <field.Checkbox label="Dodaj pracę do katalogu prac" />}
          </form.AppField>

          {addToCatalogue && (
            <form.AppField name="category">
              {() => (
                <CreatableComboboxField
                  label="Kategoria"
                  options={catalogueCategorySuggestions(workCatalogue)}
                />
              )}
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
          onChoose={collision.answer}
        />
      )}
    </>
  )
}
