import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

type InvestmentFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly investments: readonly ReferenceItemT[]
}

export function InvestmentField({ form, investments }: InvestmentFieldPropsT) {
  return (
    <form.AppField name="investment">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select label="Inwestycja" placeholder="Wybierz inwestycję" showError>
          {investments.map((inv) => (
            <SelectItem key={inv.id} value={String(inv.id)}>
              {inv.name}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
