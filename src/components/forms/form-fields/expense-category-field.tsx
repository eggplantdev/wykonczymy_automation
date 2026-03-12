import { SelectItem } from '@/components/ui/select'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/constants/transfers'
import type { ReferenceItemT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type ExpenseCategoryFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  readonly expenseCategories: readonly ReferenceItemT[]
}

export function ExpenseCategoryField({ form, expenseCategories }: ExpenseCategoryFieldPropsT) {
  return (
    <form.AppField name="expenseCategory">
      {(field: AppFieldComponentsT) => (
        <field.Select label={EXPENSE_CATEGORY_LABEL} placeholder="Wybierz typ" showError>
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
