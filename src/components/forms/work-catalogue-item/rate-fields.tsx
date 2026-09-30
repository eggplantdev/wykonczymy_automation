'use client'

import { toMoney } from '@/lib/utils/parse-decimal-input'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { SelectItem } from '@/components/ui/select'
import { PRICE_SOURCES } from '@/lib/kosztorys/constants'
import { RATE_LABELS } from '@/lib/kosztorys/labels'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import type { CatalogueRateT } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import type { RatePlaneValuesT } from './work-catalogue-item-schema'

export type PlaneT = 'wTools' | 'ownTools'

export type RateFieldNameT = `${PlaneT}${'Source' | 'Rate' | 'Coeff'}`

const PLANE_LABEL = {
  wTools: RATE_LABELS.w_tools,
  ownTools: RATE_LABELS.own_tools,
} as const

// What gets stored for one płaszczyzna, derived from the źródło the owner picked: at most one of the
// two kolumn carries a number, and „auto" carries neither. The form's own coeff/rate strings are
// deliberately not both read — whichever field the unpicked źródło left behind is stale.
export const rateColumns = (plane: PlaneT, value: RatePlaneValuesT): CatalogueRateT => {
  const source = value[`${plane}Source`]
  return {
    rate: source === 'amount' ? toMoney(value[`${plane}Rate`]) : null,
    coeff: source === 'coeff' ? toMoney(value[`${plane}Coeff`]) : null,
  }
}

// The selector carries the plane's own name: with both on „auto" the two inputs are gone, so the
// selectors are the only thing left to tell the planes apart.
//
// `sourceLabels` is a prop because „auto" means a different inwestycja per caller: the katalog's
// wpis has none yet, the rozpiska's praca already sits in one.
export function RateField({
  form,
  plane,
  sourceLabels,
}: {
  form: FormWithFieldT<RateFieldNameT>
  plane: PlaneT
  sourceLabels: Record<PriceSourceT, string>
}) {
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
                {sourceLabels[value]}
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
