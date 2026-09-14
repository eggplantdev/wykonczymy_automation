import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { useState } from 'react'
import { ActiveFilterLabel } from '@/components/ui/active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import { activeOrSelected } from '@/lib/utils/is-active-ref'

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

// „Pracownik" is picked under three field names (worker / holder / owner); the wording is one thing.
const WORKER_COPY = {
  label: 'Pracownik',
  placeholder: 'Wybierz pracownika',
  searchPlaceholder: 'Szukaj pracownika...',
  emptySearchMessage: 'Nie znaleziono pracownika.',
  noItemsMessage: 'Brak pracowników',
  noActiveItemsMessage: 'Brak aktywnych pracowników',
} as const

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
  worker: { ...WORKER_COPY, name: 'worker' },
  holder: { ...WORKER_COPY, name: 'holder' },
  owner: {
    ...WORKER_COPY,
    name: 'owner',
    label: 'Właściciel',
    placeholder: 'Wybierz właściciela',
  },
} as const satisfies Record<string, VariantConfigT>

type EntityComboboxFieldPropsT<TVariant extends keyof typeof VARIANT_CONFIG> = {
  form: FormWithFieldT<(typeof VARIANT_CONFIG)[TVariant]['name']>
  variant: TVariant
  items: EntityItemT[]
  // Forwarded to the inner AppField; only onChange is used at call sites (reset a dependent field).
  listeners?: { onChange?: () => void }
}

export function EntityComboboxField<TVariant extends keyof typeof VARIANT_CONFIG>({
  form,
  variant,
  items,
  listeners,
}: EntityComboboxFieldPropsT<TVariant>) {
  const [activeOnly, setActiveOnly] = useState(true)
  const config = VARIANT_CONFIG[variant]

  const selectedId = useFieldValue(form, config.name)

  const filtered = activeOrSelected(items, activeOnly, selectedId).map((item) => ({
    value: String(item.id),
    label: item.name,
  }))

  const emptyMessage = items.length === 0 ? config.noItemsMessage : config.noActiveItemsMessage
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  return (
    <form.AppField name={config.name} listeners={listeners}>
      {(field) =>
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
