'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { VehicleForm } from '@/components/forms/vehicle-form/vehicle-form'
import { createVehicleAction } from '@/lib/actions/fleet'
import type { VehicleFormValuesT } from '@/components/forms/vehicle-form/vehicle-schema'

const EMPTY_DEFAULTS: VehicleFormValuesT = {
  registration: '',
  make: '',
  model: '',
  year: '',
  vin: '',
  tyres: '',
  note: '',
  exemptions: [],
  status: 'ACTIVE',
}

export function AddVehicleDialog() {
  return (
    <FormDialog
      formId="add-vehicle"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Pojazd
        </Button>
      }
      title="Nowy pojazd"
    >
      {(onSubmitSuccess, keepOpen) => (
        <VehicleForm
          formId="add-vehicle"
          defaultValues={EMPTY_DEFAULTS}
          action={createVehicleAction}
          successMessage="Pojazd dodany"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
