'use client'

import { FieldGroup } from '@/components/ui/field'
import { Combobox } from '@/components/ui/combobox'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import FormBase from '@/components/forms/form-components/form-base'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { SelectItem } from '@/components/ui/select'
import {
  PRICE_SOURCES,
  PRICE_SOURCE_LABELS,
  RATE_LABELS,
  UNIT_SUGGESTIONS,
} from '@/lib/kosztorys/constants'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import type { CatalogueRateT } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { useWorkCatalogueItemFormStore } from '@/stores/form-stores'
import {
  toMoney,
  workCatalogueItemFormSchema,
  type WorkCatalogueItemDataT,
  type WorkCatalogueItemFormValuesT,
} from './work-catalogue-item-schema'
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

        <RateField form={form} plane="wTools" />
        <RateField form={form} plane="ownTools" />
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}

type PlaneT = 'wTools' | 'ownTools'

type RateFieldNameT = `${PlaneT}${'Source' | 'Rate' | 'Coeff'}`

const PLANE_LABEL = {
  wTools: RATE_LABELS.w_tools,
  ownTools: RATE_LABELS.own_tools,
} as const

// What the katalog stores for one płaszczyzna, derived from the źródło the owner picked: at most one
// of the two kolumn carries a number, and „auto" carries neither. The form's own coeff/rate strings
// are deliberately not both read — whichever field the unpicked źródło left behind is stale.
const rateColumns = (plane: PlaneT, value: WorkCatalogueItemFormValuesT): CatalogueRateT => {
  const source = value[`${plane}Source`]
  return {
    rate: source === 'amount' ? toMoney(value[`${plane}Rate`]) : null,
    coeff: source === 'coeff' ? toMoney(value[`${plane}Coeff`]) : null,
  }
}

// The selector carries the plane's own name: with both on „auto" the two inputs are gone, so the
// selectors are the only thing left to tell the planes apart.
function RateField({ form, plane }: { form: FormWithFieldT<RateFieldNameT>; plane: PlaneT }) {
  const label = PLANE_LABEL[plane]
  const source = useFieldValue<PriceSourceT>(form, `${plane}Source`)

  return (
    <>
      <form.AppField
        name={`${plane}Source`}
        // The two inputs below UNMOUNT with the źródło, and TanStack keeps the errors an unmounted
        // field was left with — so a „jest wymagana" raised by a failed submit would then survive
        // forever and block every later one. Resetting both drops the stale error together with the
        // liczba the owner just stopped using.
        listeners={{
          onChange: () => {
            form.resetField(`${plane}Rate`)
            form.resetField(`${plane}Coeff`)
          },
        }}
      >
        {(field) => (
          <field.Select label={`${label} — źródło`}>
            {PRICE_SOURCES.map((value) => (
              <SelectItem key={value} value={value}>
                {SOURCE_OPTION_LABELS[value]}
              </SelectItem>
            ))}
          </field.Select>
        )}
      </form.AppField>

      {/* Hidden, not disabled: a disabled input still invites a liczba that would be thrown out. */}
      {source === 'amount' && (
        <form.AppField name={`${plane}Rate`}>
          {(field) => (
            <field.Input label={`${label} (PLN)`} type="number" placeholder="0.00" showError />
          )}
        </form.AppField>
      )}

      {source === 'coeff' && (
        <form.AppField name={`${plane}Coeff`}>
          {(field) => (
            <field.Input
              label={`Mnożnik — ${label.toLowerCase()}`}
              type="number"
              placeholder="0.65"
              showError
            />
          )}
        </form.AppField>
      )}
    </>
  )
}
