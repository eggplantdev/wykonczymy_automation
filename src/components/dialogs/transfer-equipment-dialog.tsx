'use client'

import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { EquipmentTransferForm } from '@/components/forms/equipment-transfer-form/equipment-transfer-form'
import { transferEquipmentAction } from '@/lib/actions/equipment'
import { warsawToday } from '@/lib/utils/days'
import type { EquipmentTransferFormValuesT } from '@/components/forms/equipment-transfer-form/equipment-transfer-schema'
import type { EquipmentRowT } from '@/lib/equipment/types'
import type { WarehouseOptionT } from '@/lib/equipment/types'
import type { InvestmentRefT, WorkerRefT } from '@/types/reference-data'

type TransferEquipmentDialogPropsT = {
  equipment: EquipmentRowT
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
  investments: InvestmentRefT[]
}

export function TransferEquipmentDialog({
  equipment,
  workers,
  warehouses,
  investments,
}: TransferEquipmentDialogPropsT) {
  const formId = `transfer-equipment-${equipment.id}`

  const defaultValues: EquipmentTransferFormValuesT = {
    equipment: String(equipment.id),
    occurredAt: warsawToday(),
    targetKind: 'holder',
    holder: '',
    warehouse: '',
    serviceProvider: '',
    investment: '',
    cost: '',
    note: '',
  }

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={
        <Button size="sm" variant="outline">
          <ArrowRightLeft />
          <span>Przekaż</span>
        </Button>
      }
      title="Przekaż sprzęt"
      description={equipment.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <EquipmentTransferForm
          formId={formId}
          defaultValues={defaultValues}
          action={transferEquipmentAction}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          workers={workers}
          warehouses={warehouses}
          investments={investments}
        />
      )}
    </FormDialog>
  )
}
