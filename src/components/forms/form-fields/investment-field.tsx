import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

type InvestmentFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly investments: readonly ReferenceItemT[]
}

export function InvestmentField({ form, investments }: InvestmentFieldPropsT) {
  const [activeOnly, setActiveOnly] = useState(true)

  const filtered = investments.filter((inv) => !activeOnly || inv.active !== false)

  return (
    <form.AppField name="investment">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select
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
          showError
        >
          {filtered
            .toSorted((a, b) => a.name.localeCompare(b.name, 'pl'))
            .map((inv) => (
              <SelectItem key={inv.id} value={String(inv.id)}>
                {inv.name}
              </SelectItem>
            ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
