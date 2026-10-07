'use client'

import type { ReactNode } from 'react'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import {
  changedTranslationTexts,
  type DescriptionTranslationsT,
} from '@/lib/i18n/description-translations'
import { LANGUAGE_SHORT, TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import { PRICE_SOURCE_LABELS } from '@/lib/kosztorys/labels'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import { useWorkCatalogueItemFormStore } from '@/stores/form-stores'
import {
  catalogueFigures,
  workCatalogueItemFormSchema,
  type WorkCatalogueItemDataT,
  type WorkCatalogueItemFormValuesT,
} from './work-catalogue-item-schema'
import { RateField } from './rate-fields'
import { CreatableComboboxField } from './creatable-combobox-field'
import type { ActionResultT } from '@/types/action'

type WorkCatalogueItemFormPropsT = {
  formId: string
  defaultValues: WorkCatalogueItemFormValuesT
  /** Categories already in the katalog, offered as quick-picks so they don't fork on a typo. */
  categorySuggestions: readonly string[]
  action: (data: WorkCatalogueItemDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  /** False on the edit dialog — see `useManagedForm`. */
  persistDraft?: boolean
  /** The map the translation fields were filled from; a new entry has none. */
  translationBaseline?: DescriptionTranslationsT
  /** Rendered under the Polish opis — the add dialog's AI checkbox, which the edit dialog has no use for. */
  children?: ReactNode
}

// The katalog names its own „auto" — a cennik wpis has no inwestycja yet, so the sentence has to say
// whose współczynnik will price it. The other two are the shared names, unchanged.
const SOURCE_OPTION_LABELS: Record<PriceSourceT, string> = {
  ...PRICE_SOURCE_LABELS,
  auto: 'auto — ze współczynnika inwestycji, do której praca trafi',
}

export function WorkCatalogueItemForm({
  formId,
  defaultValues,
  categorySuggestions,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
  translationBaseline,
  children,
}: WorkCatalogueItemFormPropsT) {
  const { form, reset } = useManagedForm<WorkCatalogueItemFormValuesT, WorkCatalogueItemDataT>({
    formId,
    useFormStore: useWorkCatalogueItemFormStore,
    schema: workCatalogueItemFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    persistDraft,
    toData: (value) => ({
      description: value.description,
      category: value.category,
      unit: value.unit,
      ...catalogueFigures(value),
      workNote: value.workNote,
      translationEdits: changedTranslationTexts(translationBaseline, value.translations),
      translationSeed: translationBaseline,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="description">
          {(field) => (
            <field.Textarea label="Opis pracy" rows={2} placeholder="Malowanie ścian" showError />
          )}
        </form.AppField>
        {children}
        <form.AppField name="workNote">
          {(field) => <field.Textarea label={COLUMN_LABELS.workNote} rows={3} />}
        </form.AppField>

        {TRANSLATION_LANGUAGES.map((language) => (
          <form.AppField key={language} name={`translations.${language}`}>
            {(field) => (
              <field.Textarea label={`Opis pracy (${LANGUAGE_SHORT[language]})`} rows={2} />
            )}
          </form.AppField>
        ))}

        <form.AppField name="category">
          {() => <CreatableComboboxField label="Kategoria" options={categorySuggestions} />}
        </form.AppField>

        <form.AppField name="unit">
          {() => <CreatableComboboxField label="j.m." options={UNIT_SUGGESTIONS} />}
        </form.AppField>

        <form.AppField name="clientPrice">
          {(field) => (
            <field.Input label="Cena j.m. (PLN)" type="number" placeholder="0.00" showError />
          )}
        </form.AppField>

        <RateField form={form} plane="wTools" sourceLabels={SOURCE_OPTION_LABELS} />
        <RateField form={form} plane="ownTools" sourceLabels={SOURCE_OPTION_LABELS} />
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
