import { useState } from 'react'
import { ActiveFilterLabel } from './active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type EntityItemT = {
  id: number
  name: string
  active?: boolean
}

type VariantConfigT = {
  name: string
  label: string
  placeholder: string
  searchPlaceholder: string
  emptySearchMessage: string
  noItemsMessage: string
  noActiveItemsMessage: string
}

const VARIANT_CONFIG = {
  investment: {
    name: 'investment',
    label: 'Inwestycja',
    placeholder: 'Wybierz inwestycję',
    searchPlaceholder: 'Szukaj inwestycji...',
    emptySearchMessage: 'Nie znaleziono inwestycji.',
    noItemsMessage: 'Brak inwestycji',
    noActiveItemsMessage: 'Brak aktywnych inwestycji',
  },
  worker: {
    name: 'worker',
    label: 'Pracownik',
    placeholder: 'Wybierz pracownika',
    searchPlaceholder: 'Szukaj pracownika...',
    emptySearchMessage: 'Nie znaleziono pracownika.',
    noItemsMessage: 'Brak pracowników',
    noActiveItemsMessage: 'Brak aktywnych pracowników',
  },
} as const satisfies Record<string, VariantConfigT>

type EntityComboboxFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  variant: keyof typeof VARIANT_CONFIG
  items: EntityItemT[]
}

export function EntityComboboxField({ form, variant, items }: EntityComboboxFieldPropsT) {
  const [activeOnly, setActiveOnly] = useState(true)
  const config = VARIANT_CONFIG[variant]

  const filtered = items
    .filter((item) => !activeOnly || item.active !== false)
    .map((item) => ({ value: String(item.id), label: item.name }))

  const emptyMessage = items.length === 0 ? config.noItemsMessage : config.noActiveItemsMessage
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  return (
    <form.AppField name={config.name}>
      {(field: AppFieldComponentsT) =>
        filtered.length > 0 ? (
          <field.Combobox
            label={config.label}
            labelExtra={labelExtra}
            placeholder={config.placeholder}
            searchPlaceholder={config.searchPlaceholder}
            emptyMessage={config.emptySearchMessage}
            items={filtered}
            showError
          />
        ) : (
          <EmptyFieldMessage label={config.label} message={emptyMessage} labelExtra={labelExtra} />
        )
      }
    </form.AppField>
  )
}
