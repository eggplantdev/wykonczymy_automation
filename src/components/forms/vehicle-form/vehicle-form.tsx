'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { InspectionTypeCheckboxes } from '@/components/fleet/inspection-type-checkboxes'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import FormBase from '@/components/forms/form-components/form-base'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { SCHEDULED_INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'
import { useVehicleFormStore } from '@/stores/form-stores'
import { vehicleFormSchema, type VehicleFormValuesT } from './vehicle-schema'
import type { VehicleFormDataT } from './vehicle-schema'
import type { ActionResultT } from '@/types/action'

type VehicleFormPropsT = {
  formId: string
  defaultValues: VehicleFormValuesT
  action: (data: VehicleFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  persistDraft?: boolean
}

export function VehicleForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
}: VehicleFormPropsT) {
  const { form, reset } = useManagedForm<VehicleFormValuesT, VehicleFormDataT>({
    formId,
    useFormStore: useVehicleFormStore,
    schema: vehicleFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    persistDraft,
    toData: (value) => ({
      registration: value.registration.trim().toUpperCase(),
      make: value.make,
      model: value.model,
      year: value.year ? Number(value.year) : null,
      vin: value.vin.trim().toUpperCase(),
      tyres: value.tyres,
      note: value.note,
      exemptions: value.exemptions,
      status: value.status,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="registration">
          {(field) => <field.Input label="Numer rejestracyjny" placeholder="WX 12345" showError />}
        </form.AppField>

        <form.AppField name="make">
          {(field) => <field.Input label="Marka" placeholder="Ford" showError />}
        </form.AppField>

        <form.AppField name="model">
          {(field) => <field.Input label="Model" placeholder="Transit" showError />}
        </form.AppField>

        <form.AppField name="year">
          {(field) => <field.Input label="Rocznik" type="number" placeholder="2019" showError />}
        </form.AppField>

        <form.AppField name="vin">{(field) => <field.Input label="VIN" showError />}</form.AppField>

        <form.AppField name="tyres">
          {(field) => <field.Input label="Opony" placeholder="całoroczne" showError />}
        </form.AppField>

        <form.AppField name="note">
          {(field) => <field.Textarea label="Uwagi" rows={2} />}
        </form.AppField>

        <form.AppField name="exemptions">
          {(field) => (
            <FormBase label="Nie dotyczy (bezterminowo)" showError>
              <InspectionTypeCheckboxes
                types={SCHEDULED_INSPECTION_TYPES}
                selected={field.state.value}
                onChange={field.handleChange}
              />
            </FormBase>
          )}
        </form.AppField>

        <form.AppField name="status">
          {(field) => (
            <field.Select label="Status" showError>
              {VEHICLE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {VEHICLE_STATUS_LABELS[status].pl}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
