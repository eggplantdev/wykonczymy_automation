import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { useMemo, useState } from 'react'
import { ActiveFilterLabel } from '@/components/filters/active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import type { ReferenceItemT } from '@/types/reference-data'

type CashRegisterFieldPropsT<TName extends string> = {
  form: FormWithFieldT<TName>
  // Required, with no default: a defaulted literal has to be cast to `TName` to compile, and the
  // cast is never checked against the form — the renamed-field check this type exists for silently
  // stops applying at every call site that omits the name.
  name: TName
  label?: string
  placeholder?: string
  cashRegisters: ReferenceItemT[]
  listeners?: { onChange?: (arg: { value: string }) => void }
}

export function CashRegisterField<TName extends string>({
  form,
  name,
  label = 'Kasa',
  placeholder = 'Wybierz kasę',
  cashRegisters,
  listeners,
}: CashRegisterFieldPropsT<TName>) {
  const [activeOnly, setActiveOnly] = useState(true)

  const selectedId = useFieldValue(form, name)

  const filteredRegisters = useMemo(
    () => activeOrSelected(cashRegisters, activeOnly, selectedId),
    [cashRegisters, activeOnly, selectedId],
  )

  const emptyMessage = cashRegisters.length === 0 ? 'Brak kas' : 'Brak aktywnych kas'
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  const comboboxItems = useMemo(
    () => filteredRegisters.map((cr) => ({ value: String(cr.id), label: cr.name })),
    [filteredRegisters],
  )

  return (
    <form.AppField name={name} listeners={listeners}>
      {(field) =>
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
