import { useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectItem } from '@/components/ui/select'
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
  console.log('cash-register-field.tsx:26 - name:', name)
  console.log(cashRegisters)
  console.log({ userCashRegisterIds })

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

  return (
    <form.AppField name={name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select
          label={label}
          labelExtra={
            <label className="flex w-fit items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={activeOnly}
                onCheckedChange={(v: boolean) => setActiveOnly(v === true)}
              />
              {activeOnly ? 'Aktywne' : 'Wszystkie'}
            </label>
          }
          placeholder={placeholder}
          showError
        >
          {filteredRegisters.length > 0 ? (
            filteredRegisters.map((cr) => (
              <SelectItem key={cr.id} value={String(cr.id)}>
                {cr.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="" disabled>
              {emptyMessage}
            </SelectItem>
          )}
        </field.Select>
      )}
    </form.AppField>
  )
}
