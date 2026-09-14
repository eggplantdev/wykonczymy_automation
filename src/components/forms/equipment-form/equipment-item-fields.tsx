'use client'

import { SelectItem } from '@/components/ui/select'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { EQUIPMENT_STATUSES, EQUIPMENT_STATUS_LABELS } from '@/lib/equipment/equipment-status'

export type EquipmentItemFieldNameT =
  | 'name'
  | 'serialNumber'
  | 'make'
  | 'model'
  | 'purchaseDate'
  | 'warrantyUntil'
  | 'purchasePrice'
  | 'note'
  | 'status'

type EquipmentFieldPropsT = {
  form: FormWithFieldT<EquipmentItemFieldNameT>
}

/**
 * What the item IS — shared by „Dodaj sprzęt" and „Edytuj sprzęt".
 *
 * Price, status and the note are separate exports rather than part of this block: „Dodaj sprzęt"
 * interleaves them with the handover fields (cena beside the day it was handed over, uwagi under
 * everything), which it cannot do while they are welded into one component.
 */
export function EquipmentItemFields({ form }: EquipmentFieldPropsT) {
  return (
    <>
      <form.AppField name="name">
        {(field) => <field.Input label="Nazwa" placeholder="Szlifierka kątowa" showError />}
      </form.AppField>

      <form.AppField name="serialNumber">
        {(field) => <field.Input label="Numer seryjny" showError />}
      </form.AppField>

      <form.AppField name="make">
        {(field) => <field.Input label="Marka" placeholder="Makita" showError />}
      </form.AppField>

      <form.AppField name="model">
        {(field) => <field.Input label="Model" placeholder="GA9020" showError />}
      </form.AppField>

      <div className="flex items-start gap-4">
        <form.AppField name="purchaseDate">
          {(field) => (
            <field.DatePicker label="Data zakupu" showError fieldClassName="min-w-0 flex-1" />
          )}
        </form.AppField>

        <form.AppField name="warrantyUntil">
          {(field) => (
            <field.DatePicker label="Gwarancja do" showError fieldClassName="min-w-0 flex-1" />
          )}
        </form.AppField>
      </div>
    </>
  )
}

export function EquipmentPriceField({
  form,
  fieldClassName,
}: EquipmentFieldPropsT & { fieldClassName?: string }) {
  return (
    <form.AppField name="purchasePrice">
      {(field) => (
        <field.Input label="Cena zakupu" type="number" showError fieldClassName={fieldClassName} />
      )}
    </form.AppField>
  )
}

/** Hidden while adding: a brand-new item is „W użyciu" and nothing else. */
export function EquipmentStatusField({ form }: EquipmentFieldPropsT) {
  return (
    <form.AppField name="status">
      {(field) => (
        <field.Select label="Status" showError>
          {EQUIPMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {EQUIPMENT_STATUS_LABELS[status].pl}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}

export function EquipmentNoteField({ form }: EquipmentFieldPropsT) {
  return (
    <form.AppField name="note">
      {(field) => <field.Textarea label="Uwagi" rows={2} />}
    </form.AppField>
  )
}
