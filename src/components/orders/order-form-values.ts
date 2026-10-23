import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import { ORDER_ITEMS, type OrderItemT } from '@/lib/constants/orders'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import { findIdByName } from '@/lib/orders/find-id-by-name'
import { orderLine } from '@/lib/orders/order-line'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { warsawToday } from '@/lib/utils/days'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { ReferenceDataT } from '@/types/reference-data'

type OrderFormInputT = {
  kind: OrderItemT
  quantity: number
  unitPrice: number
  investmentId: number
  referenceData: ReferenceDataT
}

export function orderFormValues({
  kind,
  quantity,
  unitPrice,
  investmentId,
  referenceData,
}: OrderFormInputT): BulkExpenseFormValuesT {
  const item = ORDER_ITEMS[kind]
  const activeRegisters = referenceData.cashRegisters.filter(isActiveRef)
  return {
    date: warsawToday(),
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: '',
    sourceRegister:
      findIdByName(item.label, activeRegisters) || getDefaultCashRegister(referenceData),
    targetRegister: '',
    investment: String(investmentId),
    worker: '',
    settled: false,
    lineItems: [
      makeLineItem({
        description: orderLine(kind, quantity),
        amount: String(roundToCents(quantity * unitPrice)),
        expenseCategory: resolveExpenseCategoryId(
          DEFAULT_EXPENSE_CATEGORY_NAME,
          referenceData.expenseCategories,
        ),
        category: findIdByName(item.label, referenceData.otherCategories),
      }),
    ],
  }
}
