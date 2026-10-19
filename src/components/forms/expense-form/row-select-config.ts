import {
  EXPENSE_CATEGORY_LABEL,
  hasOptionalWorker,
  needsExpenseCategory,
  needsOtherCategory,
  showsOtherCategory,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { isActiveRef } from '@/lib/utils/is-active-ref'

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
