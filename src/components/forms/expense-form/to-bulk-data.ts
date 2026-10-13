import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import type { CreateBulkExpenseFormT } from '@/components/forms/expense-form/bulk-expense-schema'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'
import type { PaymentMethodT, TransferTypeT } from '@/lib/constants/transfers'

export function toBulkData(
  value: BulkExpenseFormValuesT,
  lineItems: BulkExpenseFormValuesT['lineItems'],
): CreateBulkExpenseFormT {
  const type = value.type as TransferTypeT
  return {
    date: value.date,
    type,
    paymentMethod: (value.paymentMethod as PaymentMethodT) || null,
    sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
    targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
    investment: value.investment ? Number(value.investment) : undefined,
    worker: value.worker ? Number(value.worker) : undefined,
    settled: value.settled,
    lineItems: lineItems.map((item) => mapLineItem(item, type, !!value.investment)),
  }
}
