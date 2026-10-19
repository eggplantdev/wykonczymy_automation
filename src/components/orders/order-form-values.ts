import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import { ORDER_ITEMS, type OrderItemT } from '@/lib/constants/orders'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import { findCategoryIdByName } from '@/lib/orders/find-category-by-name'
import { orderLine } from '@/lib/orders/order-line'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { warsawToday } from '@/lib/utils/days'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

type OrderFormInputT = {
  kind: OrderItemT
  quantity: number
  investmentId: number
  prices: Pick<OrderSettingsT, 'bigBagPrice' | 'containerPrice'>
  referenceData: ReferenceDataT
}

export function orderFormValues({
  kind,
  quantity,
  investmentId,
  prices,
  referenceData,
}: OrderFormInputT): BulkExpenseFormValuesT {
  const item = ORDER_ITEMS[kind]
  return {
    date: warsawToday(),
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: '',
    sourceRegister: getDefaultCashRegister(referenceData),
    targetRegister: '',
    investment: String(investmentId),
    worker: '',
    settled: false,
    lineItems: [
      makeLineItem({
        description: orderLine(kind, quantity),
        amount: String(roundToCents(quantity * prices[item.priceKey])),
        expenseCategory: resolveExpenseCategoryId(
          DEFAULT_EXPENSE_CATEGORY_NAME,
          referenceData.expenseCategories,
        ),
        category: findCategoryIdByName(item.label, referenceData.otherCategories),
      }),
    ],
  }
}
