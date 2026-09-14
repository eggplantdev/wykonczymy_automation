'use client'

import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import {
  EquipmentOccurredAtField,
  EquipmentTargetFields,
} from '@/components/forms/form-fields/equipment-target-field'
import { toTargetData } from '@/lib/schemas/equipment-target'
import {
  EquipmentItemFields,
  EquipmentNoteField,
  EquipmentPriceField,
} from './equipment-item-fields'
import { addEquipmentFormSchema, toEquipmentData } from './equipment-schema'
import type { AddEquipmentDataT, AddEquipmentFormValuesT } from './equipment-schema'
import { useAddEquipmentFormStore } from '@/stores/form-stores'
import type { WarehouseOptionT } from '@/lib/equipment/types'
import type { ActionResultT } from '@/types/action'
import type { InvestmentRefT, WorkerRefT } from '@/types/reference-data'

type AddEquipmentFormPropsT = {
  formId: string
  defaultValues: AddEquipmentFormValuesT
  action: (data: AddEquipmentDataT) => Promise<ActionResultT>
  onSubmitSuccess: () => void
  keepOpen?: boolean
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
  investments: InvestmentRefT[]
}

/** The item and its first placement in one submit — see `addEquipmentSchema` for why they're one. */
export function AddEquipmentForm({
  formId,
  defaultValues,
  action,
  onSubmitSuccess,
  keepOpen,
  workers,
  warehouses,
  investments,
}: AddEquipmentFormPropsT) {
  const { form, reset } = useManagedForm<AddEquipmentFormValuesT, AddEquipmentDataT>({
    formId,
    useFormStore: useAddEquipmentFormStore,
    schema: addEquipmentFormSchema,
    defaultValues,
    keepOpen,
    successMessage: 'Sprzęt dodany',
    onSubmitSuccess,
    action,
    // A draft carries the day it was saved on, which is not what „data przekazania = dziś" promises
    // when the dialog reopens tomorrow.
    mergeStored: (stored) => ({
      ...stored,
      occurredAt: stored.occurredAt || defaultValues.occurredAt,
    }),
    toData: (values) => ({
      ...toEquipmentData(values),
      ...toTargetData(values),
      occurredAt: values.occurredAt,
      investment: values.investment ? Number(values.investment) : null,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <EquipmentItemFields form={form} />

        <div className="flex items-start gap-4">
          <EquipmentPriceField form={form} fieldClassName="min-w-0 flex-1" />
          <EquipmentOccurredAtField form={form} fieldClassName="min-w-0 flex-1" />
        </div>

        <EquipmentTargetFields
          form={form}
          workers={workers}
          warehouses={warehouses}
          investments={investments}
          showOccurredAt={false}
        />

        <EquipmentNoteField form={form} />
      </FieldGroup>

      <FormFooter label="Dodaj" submittingLabel="Dodawanie..." className="mt-6" />
    </FormShell>
  )
}
