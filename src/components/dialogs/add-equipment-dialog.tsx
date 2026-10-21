'use client'

import { AddButton } from '@/components/ui/add-button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { AddEquipmentForm } from '@/components/forms/equipment-form/add-equipment-form'
import { createEquipmentAction } from '@/lib/actions/equipment'
import { warsawToday } from '@/lib/utils/days'
import type { AddEquipmentFormValuesT } from '@/components/forms/equipment-form/equipment-schema'
import type { WarehouseOptionT } from '@/lib/equipment/types'
import { useReferenceData } from '@/hooks/use-reference-data'

type AddEquipmentDialogPropsT = {
  warehouses: WarehouseOptionT[]
}

export function AddEquipmentDialog({ warehouses }: AddEquipmentDialogPropsT) {
  const referenceData = useReferenceData()
  const defaultValues: AddEquipmentFormValuesT = {
    name: '',
    serialNumber: '',
    make: '',
    model: '',
    purchaseDate: '',
    warrantyUntil: '',
    purchasePrice: '',
    note: '',
    status: 'IN_USE',
    occurredAt: warsawToday(),
    targetKind: 'warehouse',
    holder: '',
    warehouse: '',
    serviceProvider: '',
    investment: '',
  }

  return (
    <FormDialog formId="add-equipment" trigger={<AddButton>Sprzęt</AddButton>} title="Nowy sprzęt">
      {(onSubmitSuccess, keepOpen) => (
        <AddEquipmentForm
          formId="add-equipment"
          defaultValues={defaultValues}
          action={createEquipmentAction}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          workers={referenceData?.workers ?? []}
          warehouses={warehouses}
          investments={referenceData?.investments ?? []}
        />
      )}
    </FormDialog>
  )
}
