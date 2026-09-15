'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { VehicleForm } from '@/components/forms/vehicle-form/vehicle-form'
import { updateVehicleAction } from '@/lib/actions/fleet'
import type { VehicleRecordT } from '@/lib/fleet/types'

type EditVehicleDialogPropsT = {
  vehicle: VehicleRecordT
}

export function EditVehicleDialog({ vehicle }: EditVehicleDialogPropsT) {
  const formId = `edit-vehicle-${vehicle.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={<EditButton label="Edytuj pojazd" showLabel />}
      title="Edytuj pojazd"
      description={`${vehicle.make} ${vehicle.model}`}
    >
      {(onSubmitSuccess, keepOpen) => (
        <VehicleForm
          formId={formId}
          defaultValues={{
            registration: vehicle.registration,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year === null ? '' : String(vehicle.year),
            vin: vehicle.vin,
            tyres: vehicle.tyres,
            note: vehicle.note,
            exemptions: vehicle.exemptions,
            status: vehicle.status,
          }}
          action={(data) => updateVehicleAction(vehicle.id, data)}
          successMessage="Pojazd zaktualizowany"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
        />
      )}
    </FormDialog>
  )
}
