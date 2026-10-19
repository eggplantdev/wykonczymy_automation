'use client'

import {
  EXPENSE_CATEGORY_LABEL,
  hasOptionalWorker,
  needsExpenseCategory,
  needsOtherCategory,
  showsOtherCategory,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'

export type RowSelectConfigT = {
  fieldName: 'category' | 'expenseCategory' | 'worker'
  label: string
  placeholder: string
  options: { id: number; name: string }[]
}

const otherCategoryConfig = (type: string, refData: ReferenceDataBaseT): RowSelectConfigT => ({
  fieldName: 'category',
  label: 'Kategoria',
  placeholder: needsOtherCategory(type) ? 'Kategoria *' : 'Opcjonalnie',
  options: refData.otherCategories,
})

export function getInlineCategory(
  type: string,
  refData: ReferenceDataBaseT,
  hasInvestment?: boolean,
): RowSelectConfigT | undefined {
  if (needsExpenseCategory(type, hasInvestment)) {
    return {
      fieldName: 'expenseCategory',
      label: EXPENSE_CATEGORY_LABEL,
      placeholder: `${EXPENSE_CATEGORY_LABEL} *`,
      options: refData.expenseCategories,
    }
  }
  if (showsOtherCategory(type)) return otherCategoryConfig(type, refData)
  return undefined
}

const workerConfig = (refData: ReferenceDataBaseT): RowSelectConfigT => ({
  fieldName: 'worker',
  label: 'Pracownik',
  placeholder: 'Opcjonalnie',
  options: refData.workers.filter(isActiveRef),
})

export function getSecondRowSelects(type: string, refData: ReferenceDataBaseT): RowSelectConfigT[] {
  const selects: RowSelectConfigT[] = []
  if (needsExpenseCategory(type) && showsOtherCategory(type))
    selects.push(otherCategoryConfig(type, refData))
  if (hasOptionalWorker(type)) selects.push(workerConfig(refData))
  return selects
}

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
