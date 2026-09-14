'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InspectionForm } from '@/components/forms/inspection-form/inspection-form'
import { createInspectionAction } from '@/lib/actions/fleet'
import { addMonthsToDay, warsawToday } from '@/lib/utils/days'
import { INSPECTION_INTERVAL_MONTHS } from '@/lib/fleet/inspection-types'
import type { InspectionFormValuesT } from '@/components/forms/inspection-form/inspection-schema'
import type { FleetRowT } from '@/types/fleet'

type AddInspectionDialogPropsT = {
  vehicles: Pick<FleetRowT, 'id' | 'registration' | 'make' | 'model' | 'latestOdometer'>[]
  /** Preselected vehicle — the vehicle page knows which car the user is looking at. */
  vehicleId?: number
}

const DEFAULT_TYPE = 'TECHNICAL'

export function AddInspectionDialog({ vehicles, vehicleId }: AddInspectionDialogPropsT) {
  const performedAt = warsawToday()
  // The form only prefills on a type CHANGE, so the type the dialog opens on has to arrive prefilled.
  const months = INSPECTION_INTERVAL_MONTHS[DEFAULT_TYPE]

  const defaultValues: InspectionFormValuesT = {
    vehicle: vehicleId ? String(vehicleId) : '',
    type: DEFAULT_TYPE,
    performedAt,
    nextDueAt: months ? addMonthsToDay(performedAt, months) : '',
    odometer: '',
    cost: '',
    insurer: '',
    policyNumber: '',
    note: '',
  }

  return (
    <FormDialog
      formId="add-inspection"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Przegląd
        </Button>
      }
      title="Nowy przegląd"
    >
      {(onSubmitSuccess, keepOpen) => (
        <InspectionForm
          formId="add-inspection"
          defaultValues={defaultValues}
          lockedVehicleId={vehicleId}
          action={createInspectionAction}
          successMessage="Przegląd zapisany"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          vehicles={vehicles}
        />
      )}
    </FormDialog>
  )
}
