import { EXPENSE_CATEGORY_LABEL } from '@/lib/constants/transfers'
import type { ReferenceItemT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type ExpenseCategoryFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  expenseCategories: ReferenceItemT[]
}

export function ExpenseCategoryField({ form, expenseCategories }: ExpenseCategoryFieldPropsT) {
  const items = expenseCategories.map((cat) => ({
    value: String(cat.id),
    label: cat.name,
  }))

  return (
    <form.AppField name="expenseCategory">
      {(field: AppFieldComponentsT) => (
        <field.Combobox
          label={EXPENSE_CATEGORY_LABEL}
          placeholder="Wybierz typ"
          searchPlaceholder="Szukaj kategorii..."
          emptyMessage="Nie znaleziono kategorii."
          items={items}
          showError
        />
      )}
    </form.AppField>
  )
}
