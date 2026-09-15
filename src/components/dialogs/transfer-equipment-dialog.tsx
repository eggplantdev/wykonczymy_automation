'use client'

import { ArrowRightLeft } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
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
  showLabel?: boolean
}

export function TransferEquipmentDialog({
  equipment,
  workers,
  warehouses,
  investments,
  showLabel,
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
        <RowActionButton
          icon={ArrowRightLeft}
          label="Przekaż sprzęt"
          text="Przekaż"
          showLabel={showLabel}
        />
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
