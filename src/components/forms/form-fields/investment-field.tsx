import { useState } from 'react'
import { ActiveFilterLabel } from './active-filter-label'
import { EmptyFieldMessage } from './empty-field-message'
import type { ReferenceItemT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type InvestmentFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly investments: readonly ReferenceItemT[]
}

export function InvestmentField({ form, investments }: InvestmentFieldPropsT) {
  const [activeOnly, setActiveOnly] = useState(true)

  const items = investments
    .filter((inv) => !activeOnly || inv.active !== false)
    .map((inv) => ({ value: String(inv.id), label: inv.name }))

  const emptyMessage = investments.length === 0 ? 'Brak inwestycji' : 'Brak aktywnych inwestycji'
  const labelExtra = <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />

  return (
    <form.AppField name="investment">
      {(field: AppFieldComponentsT) =>
        items.length > 0 ? (
          <field.Combobox
            label="Inwestycja"
            labelExtra={labelExtra}
            placeholder="Wybierz inwestycję"
            searchPlaceholder="Szukaj inwestycji..."
            emptyMessage="Nie znaleziono inwestycji."
            items={items}
            showError
          />
        ) : (
          <EmptyFieldMessage label="Inwestycja" message={emptyMessage} labelExtra={labelExtra} />
        )
      }
    </form.AppField>
  )
}
