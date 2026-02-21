import { useMemo } from 'react'
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
  name = 'cashRegister',
  label = 'Kasa',
  placeholder = 'Wybierz kasę',
  cashRegisters,
  userCashRegisterIds,
}: CashRegisterFieldPropsT) {
  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )

  return (
    <form.AppField name={name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select label={label} placeholder={placeholder} showError>
          {cashRegisters
            .filter((cr) => !ownedRegisterSet || ownedRegisterSet.has(cr.id))
            .map((cr) => (
              <SelectItem key={cr.id} value={String(cr.id)}>
                {cr.name}
              </SelectItem>
            ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
