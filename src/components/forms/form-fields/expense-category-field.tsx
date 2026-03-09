import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

type ExpenseCategoryFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly expenseCategories: readonly ReferenceItemT[]
}

export function ExpenseCategoryField({ form, expenseCategories }: ExpenseCategoryFieldPropsT) {
  return (
    <form.AppField name="expenseCategory">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select label="Kategoria wydatku" placeholder="Wybierz kategorię" showError>
          {expenseCategories.map((cat) => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.name}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
