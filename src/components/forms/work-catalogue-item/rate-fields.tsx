'use client'

import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { SelectItem } from '@/components/ui/select'
import { PRICE_SOURCES } from '@/lib/kosztorys/constants'
import { RATE_LABELS } from '@/lib/kosztorys/labels'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import type { PlaneT } from './work-catalogue-item-schema'

export type RateFieldNameT = `${PlaneT}${'Source' | 'Rate' | 'Coeff'}`

const PLANE_LABEL = {
  wTools: RATE_LABELS.w_tools,
  ownTools: RATE_LABELS.own_tools,
} as const

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
        // forever and block every later one.
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
