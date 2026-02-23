import { useMemo, useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { ActiveFilterLabel } from './active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import type { ReferenceItemT } from '@/types/reference-data'

type CashRegisterFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly name?: string
  readonly label?: string
  readonly placeholder?: string
  readonly cashRegisters: readonly ReferenceItemT[]
  readonly userCashRegisterIds?: number[]
}

export function CashRegisterField({
  form,
  name = 'sourceRegister',
  label = 'Kasa',
  placeholder = 'Wybierz kasę',
  cashRegisters,
  userCashRegisterIds,
}: CashRegisterFieldPropsT) {
  const [activeOnly, setActiveOnly] = useState(true)

  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )

  const availableRegisters = cashRegisters.filter(
    (cr) => !ownedRegisterSet || ownedRegisterSet.has(cr.id),
  )
  const filteredRegisters = availableRegisters.filter((cr) => !activeOnly || cr.active !== false)

  const emptyMessage = availableRegisters.length === 0 ? 'Brak kas' : 'Brak aktywnych kas'
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  return (
    <form.AppField name={name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) =>
        filteredRegisters.length > 0 ? (
          <field.Select label={label} labelExtra={labelExtra} placeholder={placeholder} showError>
            {filteredRegisters.map((cr) => (
              <SelectItem key={cr.id} value={String(cr.id)}>
                {cr.name}
              </SelectItem>
            ))}
          </field.Select>
        ) : (
          <EmptyFieldMessage label={label} message={emptyMessage} labelExtra={labelExtra} />
        )
      }
    </form.AppField>
  )
}
