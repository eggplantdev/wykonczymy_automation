import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import type { ReferenceItemT } from '@/types/reference-data'

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

  return (
    <form.AppField name="investment">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Combobox
          label="Inwestycja"
          labelExtra={
            <label className="flex w-fit items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={activeOnly}
                onCheckedChange={(v: boolean) => setActiveOnly(v === true)}
              />
              {activeOnly ? 'Aktywne' : 'Wszystkie'}
            </label>
          }
          placeholder="Wybierz inwestycję"
          searchPlaceholder="Szukaj inwestycji..."
          emptyMessage="Nie znaleziono inwestycji."
          items={items}
          showError
        />
      )}
    </form.AppField>
  )
}
