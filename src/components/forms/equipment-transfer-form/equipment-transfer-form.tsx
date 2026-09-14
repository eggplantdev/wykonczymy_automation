'use client'

import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { EquipmentTargetFields } from '@/components/forms/form-fields/equipment-target-field'
import { toTargetData } from '@/lib/schemas/equipment-target'
import { equipmentTransferFormSchema } from './equipment-transfer-schema'
import type {
  EquipmentTransferDataT,
  EquipmentTransferFormValuesT,
} from './equipment-transfer-schema'
import { useEquipmentTransferFormStore } from '@/stores/form-stores'
import type { EquipmentTargetKindT } from '@/lib/equipment/target-kinds'
import type { WarehouseOptionT } from '@/lib/equipment/types'
import type { ActionResultT } from '@/types/action'
import type { InvestmentRefT, WorkerRefT } from '@/types/reference-data'

type EquipmentTransferFormPropsT = {
  formId: string
  defaultValues: EquipmentTransferFormValuesT
  action: (data: EquipmentTransferDataT) => Promise<ActionResultT>
  onSubmitSuccess: () => void
  keepOpen?: boolean
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
  investments: InvestmentRefT[]
}

export function EquipmentTransferForm({
  formId,
  defaultValues,
  action,
  onSubmitSuccess,
  keepOpen,
  workers,
  warehouses,
  investments,
}: EquipmentTransferFormPropsT) {
  const { form, reset } = useManagedForm<EquipmentTransferFormValuesT, EquipmentTransferDataT>({
    formId,
    useFormStore: useEquipmentTransferFormStore,
    schema: equipmentTransferFormSchema,
    defaultValues,
    keepOpen,
    successMessage: 'Przekazanie zapisane',
    onSubmitSuccess,
    action,
    // The draft store is shared with every other item's dialog, so a restored draft can name a
    // different tool than the page the user is standing on — the page has to win.
    mergeStored: (stored) => ({
      ...stored,
      equipment: defaultValues.equipment,
      occurredAt: stored.occurredAt || defaultValues.occurredAt,
    }),
    toData: (values) => ({
      ...toTargetData(values),
      equipment: Number(values.equipment),
      occurredAt: values.occurredAt,
      investment: values.investment ? Number(values.investment) : null,
      cost: values.cost === '' ? null : Number(values.cost),
      note: values.note,
    }),
  })

  const targetKind = useFieldValue<EquipmentTargetKindT>(form, 'targetKind')

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <EquipmentTargetFields
          form={form}
          workers={workers}
          warehouses={warehouses}
          investments={investments}
        />

        {/* A cost belongs to a repair; on a handover there is nothing to pay for, and the collection
            hook nulls one that slips through anyway. */}
        {targetKind === 'service' && (
          <form.AppField name="cost">
            {(field) => <field.Input label="Koszt" type="number" showError />}
          </form.AppField>
        )}

        <form.AppField name="note">
          {(field) => <field.Textarea label="Notatka" rows={2} />}
        </form.AppField>
      </FieldGroup>

      <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
    </FormShell>
  )
}
