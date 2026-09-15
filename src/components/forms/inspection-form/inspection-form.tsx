'use client'

import { useRef } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { addMonthsToDay } from '@/lib/utils/days'
import {
  INSPECTION_INTERVAL_MONTHS,
  INSPECTION_TYPE_LABELS,
  INSPECTION_TYPES,
  type InspectionTypeT,
} from '@/lib/fleet/inspection-types'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import { submitWithInvoicePages } from '@/lib/invoices/submit-with-invoice-pages'
import { formatKm } from '@/lib/utils/format-distance'
import { useInspectionFormStore } from '@/stores/form-stores'
import { inspectionFormSchema, type InspectionFormValuesT } from './inspection-schema'
import type { InspectionFormDataT } from './inspection-schema'
import type { ActionResultT } from '@/types/action'
import type { FleetRowT } from '@/types/fleet'

type InspectionFormPropsT = {
  formId: string
  defaultValues: InspectionFormValuesT
  action: (data: InspectionFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  vehicles: Pick<FleetRowT, 'id' | 'registration' | 'make' | 'model' | 'latestOdometer'>[]
  /**
   * Pins the form to one car. The draft store is shared with the listing's dialog, so a restored
   * draft can carry a different vehicle than the page the user is on — this is what makes the page
   * win over the draft.
   */
  lockedVehicleId?: number
}

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' ? undefined : Number(value)

// Same rule, different empty: `cost` is `.nullable()` in the schema — an unknown price is a recorded
// „nobody knows", not an absent field — and `undefined` does not satisfy it.
const nullableNumber = (value: string): number | null => optionalNumber(value) ?? null

export function InspectionForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  vehicles,
  lockedVehicleId,
}: InspectionFormPropsT) {
  const { files, isIngesting, inputKey, fileInputProps, reset: resetFiles } = useFilePickIngest()

  /**
   * The last date this form itself suggested for „Następny termin" — what answers „may I overwrite
   * this" on a later type change. The real date is printed on the document, so a suggestion is never
   * an answer: a date the user chose must survive.
   *
   * NOT the field's `isTouched`: TanStack marks every field touched on the first validation pass, so
   * `isTouched` flips the moment anything else on the form is touched — the rodzaj picker that asks
   * for the suggestion included. Reading it froze the date on whatever the FIRST type change
   * proposed, so correcting OC to „Przegląd gwarancyjny" left a 12-month date on a 24-month przegląd.
   *
   * It has to track every write to the field, not just its own: a restored draft supplies the initial
   * value, and a `keepOpen` submit puts `defaultValues` back under a still-mounted form. Seeded from
   * `defaultValues` alone, the ref disagrees with the field from the first keystroke and refuses
   * every suggestion after that.
   */
  const suggestedNextDue = useRef<string | null>(null)

  const { form, reset } = useManagedForm<InspectionFormValuesT, InspectionFormDataT>({
    formId,
    useFormStore: useInspectionFormStore,
    schema: inspectionFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    onReset: () => {
      resetFiles()
      suggestedNextDue.current = defaultValues.nextDueAt
    },
    // A restored draft carries whatever date it was saved with — yesterday's, or none at all —
    // and neither is what „data przeglądu = dziś" promises when the dialog reopens.
    mergeStored: (stored) => ({
      ...stored,
      ...(lockedVehicleId && { vehicle: String(lockedVehicleId) }),
      performedAt: stored.performedAt || defaultValues.performedAt,
    }),
    // Upload first, then create — the row must never reference a media id that failed to land.
    action: async (data) => {
      // Backstop to the disabled submit button, which a keyboard Enter bypasses: a file still being
      // ingested is not in `files` yet, so the przegląd would save without its załącznik.
      if (isIngesting) {
        return { success: false, error: 'Poczekaj na przetworzenie plików.' }
      }

      return submitWithInvoicePages(files, (attachments) => action({ ...data, attachments }))
    },
    toData: (value) => ({
      vehicle: Number(value.vehicle),
      type: value.type,
      performedAt: value.performedAt,
      nextDueAt: value.nextDueAt || undefined,
      odometer: optionalNumber(value.odometer),
      cost: nullableNumber(value.cost),
      insurer: value.insurer,
      policyNumber: value.policyNumber,
      note: value.note,
      attachments: [],
    }),
  })

  suggestedNextDue.current ??= form.getFieldValue('nextDueAt')

  const currentType = useStore(form.store, (state) => state.values.type)
  /** „Odczyt licznika" records a number on a day — no deadline, no price, nothing else. */
  const isReading = currentType === 'ODOMETER'
  const currentVehicle = useStore(form.store, (state) => state.values.vehicle)
  const currentOdometer = useStore(form.store, (state) => state.values.odometer)

  /**
   * The last reading this car is known to have had, when the one being typed is below it. A swapped
   * instrument cluster makes a lower reading legitimate, so this warns and never blocks the submit.
   */
  const previousOdometer =
    vehicles.find((vehicle) => String(vehicle.id) === currentVehicle)?.latestOdometer ?? null
  const typedOdometer = optionalNumber(currentOdometer)
  const odometerWentBackwardsFrom =
    previousOdometer !== null && typedOdometer !== undefined && typedOdometer < previousOdometer
      ? previousOdometer
      : null

  const prefillNextDue = (type: InspectionTypeT) => {
    if (form.getFieldValue('nextDueAt') !== suggestedNextDue.current) return

    const months = INSPECTION_INTERVAL_MONTHS[type]
    const performedAt = form.getFieldValue('performedAt')
    const next = months && performedAt ? addMonthsToDay(performedAt, months) : ''

    suggestedNextDue.current = next
    form.setFieldValue('nextDueAt', next)
  }

  const onTypeChange = (type: InspectionTypeT) => {
    prefillNextDue(type)
    // Hiding a field does not clear it — without this a TECHNICAL row persists a polisa's number
    // that it has no business carrying.
    if (type !== 'INSURANCE') {
      form.setFieldValue('insurer', '')
      form.setFieldValue('policyNumber', '')
    }
    // A reading is not work: it has no price and nothing it makes due. `prefillNextDue` leaves a date
    // the user chose alone, which is exactly what must not survive here — and once that choice is
    // gone the field is nobody's again, so the next real type may suggest into it.
    if (type === 'ODOMETER') {
      suggestedNextDue.current = ''
      form.setFieldValue('nextDueAt', '')
      form.setFieldValue('cost', '')
    }
  }

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="vehicle">
          {(field) => (
            <field.Select label="Pojazd" placeholder="Wybierz pojazd" showError>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                  {vehicle.registration} — {vehicle.make} {vehicle.model}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        <form.AppField
          name="type"
          listeners={{ onChange: ({ value }) => onTypeChange(value as InspectionTypeT) }}
        >
          {(field) => (
            <field.Select label="Rodzaj" showError>
              {INSPECTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {INSPECTION_TYPE_LABELS[type].pl}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        <form.AppField name="performedAt">
          {(field) => <field.DatePicker label="Data wykonania" showError />}
        </form.AppField>

        {!isReading && (
          <form.AppField name="nextDueAt">
            {(field) => <field.DatePicker label="Następny termin" showError />}
          </form.AppField>
        )}

        <form.AppField name="odometer">
          {(field) => (
            <field.Input label="Przebieg (km)" type="number" placeholder="120000" showError />
          )}
        </form.AppField>

        {odometerWentBackwardsFrom !== null && (
          <p className="text-chart-orange -mt-2 text-xs">
            Ostatni zapisany przebieg to {formatKm(odometerWentBackwardsFrom)} — wpisany odczyt jest
            niższy.
          </p>
        )}

        {currentType === 'INSURANCE' && (
          <>
            <form.AppField name="insurer">
              {(field) => <field.Input label="Ubezpieczyciel" placeholder="PZU" showError />}
            </form.AppField>

            <form.AppField name="policyNumber">
              {(field) => <field.Input label="Nr polisy" showError />}
            </form.AppField>
          </>
        )}

        {!isReading && (
          <form.AppField name="cost">
            {(field) => (
              <field.Input label="Koszt (PLN)" type="number" placeholder="0.00" showError />
            )}
          </form.AppField>
        )}

        <form.AppField name="note">
          {(field) => <field.Textarea label="Notatka" rows={2} />}
        </form.AppField>

        <FileInput key={inputKey} label="Załączniki" multiple {...fileInputProps} />
      </FieldGroup>

      <FormFooter
        label={submitLabel}
        submittingLabel={submittingLabel}
        className="mt-6"
        disabled={isIngesting}
      />
    </FormShell>
  )
}
