import { needsExpenseCategory, type TransferTypeT } from '@/lib/constants/transfers'

type FormLineItemT = {
  description: string
  amount: string
  invoiceNote: string
  category: string
  expenseCategory: string
}

type PayloadLineItemT = {
  description: string
  amount: number
  invoiceNote: string | undefined
  category: number | undefined
  expenseCategory: number | undefined
}

/** Map one form line item (string fields) to the server shape. expenseCategory
 *  ("typ wydatku inwestycyjnego") rides only for types that use it — for a CORRECTION,
 *  only once the transfer has an investment. */
export function mapLineItem(
  item: FormLineItemT,
  type: TransferTypeT,
  hasInvestment?: boolean,
): PayloadLineItemT {
  return {
    description: item.description,
    amount: Number(item.amount),
    invoiceNote: item.invoiceNote || undefined,
    category: item.category ? Number(item.category) : undefined,
    expenseCategory:
      needsExpenseCategory(type, hasInvestment) && item.expenseCategory
        ? Number(item.expenseCategory)
        : undefined,
  }
}
