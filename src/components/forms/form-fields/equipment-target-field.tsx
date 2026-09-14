'use client'

import { SelectItem } from '@/components/ui/select'
import { EntityComboboxField } from '@/components/forms/form-fields/entity-combobox-field'
import { WarehouseField } from '@/components/forms/form-fields/warehouse-field'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import {
  EQUIPMENT_TARGET_KIND_LABELS,
  EQUIPMENT_TARGET_KINDS,
  type EquipmentTargetKindT,
} from '@/lib/equipment/target-kinds'
import type { WarehouseOptionT } from '@/lib/equipment/types'
import type { InvestmentRefT, WorkerRefT } from '@/types/reference-data'

export type TargetFieldNameT =
  | 'occurredAt'
  | 'targetKind'
  | 'holder'
  | 'warehouse'
  | 'serviceProvider'
  | 'investment'

type EquipmentTargetFieldsPropsT = {
  form: FormWithFieldT<TargetFieldNameT>
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
  investments: InvestmentRefT[]
  /** False in „Dodaj sprzęt", which pairs the day with „Cena zakupu" above this block. */
  showOccurredAt?: boolean
}

export function EquipmentOccurredAtField({
  form,
  fieldClassName,
}: {
  form: FormWithFieldT<TargetFieldNameT>
  fieldClassName?: string
}) {
  return (
    <form.AppField name="occurredAt">
      {(field) => (
        <field.DatePicker label="Data przekazania" showError fieldClassName={fieldClassName} />
      )}
    </form.AppField>
  )
}

/**
 * „Gdzie trafia" — one choice, then the one field that choice needs. Shared by „Przekaż" and by
 * „Dodaj sprzęt", whose first entry answers exactly the same question.
 */
export function EquipmentTargetFields({
  form,
  workers,
  warehouses,
  investments,
  showOccurredAt = true,
}: EquipmentTargetFieldsPropsT) {
  const targetKind = useFieldValue<EquipmentTargetKindT>(form, 'targetKind')

  return (
    <>
      {showOccurredAt && <EquipmentOccurredAtField form={form} />}

      <form.AppField
        name="targetKind"
        // The abandoned branches are cleared, not left dangling: a holder typed and then switched
        // away from would still be sitting in the draft when the form maps its values.
        listeners={{
          onChange: () => {
            form.resetField('holder')
            form.resetField('warehouse')
            form.resetField('serviceProvider')
            form.resetField('investment')
          },
        }}
      >
        {(field) => (
          <field.Select label="Gdzie trafia" showError>
            {EQUIPMENT_TARGET_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {EQUIPMENT_TARGET_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </field.Select>
        )}
      </form.AppField>

      {targetKind === 'holder' && (
        <>
          <EntityComboboxField form={form} variant="holder" items={workers} />
          {/* Only under a person: „na którą inwestycję to poszło" is a question about someone taking
              a tool to a job. A magazyn is where things wait between jobs, and a serwis belongs to
              the tool, not to any investment. */}
          <EntityComboboxField form={form} variant="investment" items={investments} />
        </>
      )}

      {targetKind === 'warehouse' && <WarehouseField form={form} warehouses={warehouses} />}

      {targetKind === 'service' && (
        <form.AppField name="serviceProvider">
          {(field) => <field.Input label="Serwis" placeholder="Nazwa warsztatu" showError />}
        </form.AppField>
      )}
    </>
  )
}
