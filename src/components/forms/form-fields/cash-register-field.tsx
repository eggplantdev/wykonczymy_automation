import { useMemo, useState } from 'react'
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly listeners?: Record<string, any>
}

export function CashRegisterField({
  form,
  name = 'sourceRegister',
  label = 'Kasa',
  placeholder = 'Wybierz kasę',
  cashRegisters,
  userCashRegisterIds,
  listeners,
}: CashRegisterFieldPropsT) {
  const [activeOnly, setActiveOnly] = useState(true)

  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )

  const availableRegisters = useMemo(
    () => cashRegisters.filter((cr) => !ownedRegisterSet || ownedRegisterSet.has(cr.id)),
    [cashRegisters, ownedRegisterSet],
  )

  const filteredRegisters = useMemo(
    () => availableRegisters.filter((cr) => !activeOnly || cr.active !== false),
    [availableRegisters, activeOnly],
  )

  const emptyMessage = availableRegisters.length === 0 ? 'Brak kas' : 'Brak aktywnych kas'
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  const comboboxItems = useMemo(
    () => filteredRegisters.map((cr) => ({ value: String(cr.id), label: cr.name })),
    [filteredRegisters],
  )

  return (
    <form.AppField name={name} listeners={listeners}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) =>
        filteredRegisters.length > 0 ? (
          <field.Combobox
            label={label}
            labelExtra={labelExtra}
            placeholder={placeholder}
            items={comboboxItems}
            showError
          />
        ) : (
          <EmptyFieldMessage label={label} message={emptyMessage} labelExtra={labelExtra} />
        )
      }
    </form.AppField>
  )
}
