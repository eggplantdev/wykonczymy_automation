'use client'

import { toMoney } from '@/lib/utils/parse-decimal-input'
import { FieldGroup } from '@/components/ui/field'
import { Combobox } from '@/components/ui/combobox'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import FormBase from '@/components/forms/form-components/form-base'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import { PRICE_SOURCE_LABELS } from '@/lib/kosztorys/labels'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import { useWorkCatalogueItemFormStore } from '@/stores/form-stores'
import {
  workCatalogueItemFormSchema,
  type WorkCatalogueItemDataT,
  type WorkCatalogueItemFormValuesT,
} from './work-catalogue-item-schema'
import { RateField, rateColumns } from './rate-fields'
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
}

// The katalog names its own „auto" — a cennik wpis has no inwestycja yet, so the sentence has to say
// whose współczynnik will price it. The other two are the shared names, unchanged.
const SOURCE_OPTION_LABELS: Record<PriceSourceT, string> = {
  ...PRICE_SOURCE_LABELS,
  auto: 'auto — ze współczynnika inwestycji, do której praca trafi',
}

// Matches `Input`, so the two comboboxes read as fields you can type into rather than as captions.
const COMBOBOX_FIELD = 'border-input bg-background h-9 w-full rounded-md border px-3'

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
    toData: (value) => {
      const wTools = rateColumns('wTools', value)
      const ownTools = rateColumns('ownTools', value)
      return {
        description: value.description,
        category: value.category,
        unit: value.unit,
        clientPrice: toMoney(value.clientPrice),
        wToolsRate: wTools.rate,
        wToolsRateCoeff: wTools.coeff,
        ownToolsRate: ownTools.rate,
        ownToolsRateCoeff: ownTools.coeff,
      }
    },
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="description">
          {(field) => (
            <field.Textarea label="Opis pracy" rows={2} placeholder="Malowanie ścian" showError />
          )}
        </form.AppField>

        <form.AppField name="category">
          {(field) => (
            <FormBase label="Kategoria" showError>
              <Combobox
                value={field.state.value}
                onChange={field.handleChange}
                options={categorySuggestions}
                allowCustom
                modal
                className={COMBOBOX_FIELD}
                contentClassName="w-(--radix-popover-trigger-width)"
                placeholder="Wybierz lub wpisz nową…"
              />
            </FormBase>
          )}
        </form.AppField>

        <form.AppField name="unit">
          {(field) => (
            <FormBase label="j.m." showError>
              <Combobox
                value={field.state.value}
                onChange={field.handleChange}
                options={UNIT_SUGGESTIONS}
                allowCustom
                modal
                className={COMBOBOX_FIELD}
                contentClassName="w-(--radix-popover-trigger-width)"
                placeholder="Wybierz lub wpisz nową…"
              />
            </FormBase>
          )}
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
