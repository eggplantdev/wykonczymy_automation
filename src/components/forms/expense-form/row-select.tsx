'use client'

import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'
import type { RowSelectConfigT } from '@/components/forms/expense-form/row-select-config'

export function RowSelect({
  form,
  index,
  config,
  fieldClassName,
}: {
  form: BulkExpenseFormApiT
  index: number
  config: RowSelectConfigT
  fieldClassName?: string
}) {
  return (
    <form.AppField name={`lineItems[${index}].${config.fieldName}`}>
      {(field) => (
        <field.Combobox
          label={config.label}
          placeholder={config.placeholder}
          searchPlaceholder={`Szukaj: ${config.label.toLowerCase()}...`}
          emptyMessage="Nie znaleziono."
          items={config.options.map((opt) => ({ value: String(opt.id), label: opt.name }))}
          fieldClassName={fieldClassName}
        />
      )}
    </form.AppField>
  )
}
