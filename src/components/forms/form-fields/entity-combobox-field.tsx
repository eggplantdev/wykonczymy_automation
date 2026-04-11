import { useState } from 'react'
import { ActiveFilterLabel } from './active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type EntityItemT = {
  id: number
  name: string
  active?: boolean
}

type EntityComboboxFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  name: string
  items: EntityItemT[]
  label: string
  placeholder: string
  searchPlaceholder: string
  emptySearchMessage: string
  noItemsMessage: string
  noActiveItemsMessage: string
}

export function EntityComboboxField({
  form,
  name,
  items,
  label,
  placeholder,
  searchPlaceholder,
  emptySearchMessage,
  noItemsMessage,
  noActiveItemsMessage,
}: EntityComboboxFieldPropsT) {
  const [activeOnly, setActiveOnly] = useState(true)

  const filtered = items
    .filter((item) => !activeOnly || item.active !== false)
    .map((item) => ({ value: String(item.id), label: item.name }))

  const emptyMessage = items.length === 0 ? noItemsMessage : noActiveItemsMessage
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  return (
    <form.AppField name={name}>
      {(field: AppFieldComponentsT) =>
        filtered.length > 0 ? (
          <field.Combobox
            label={label}
            labelExtra={labelExtra}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptySearchMessage}
            items={filtered}
            showError
          />
        ) : (
          <EmptyFieldMessage label={label} message={emptyMessage} labelExtra={labelExtra} />
        )
      }
    </form.AppField>
  )
}
