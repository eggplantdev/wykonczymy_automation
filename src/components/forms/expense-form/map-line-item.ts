import {
  billsNetAmount,
  needsExpenseCategory,
  showsOtherCategory,
  type TransferTypeT,
} from '@/lib/constants/transfers'
import { normalizeNip } from '@/lib/utils/nip'

type FormLineItemT = {
  description: string
  amount: string
  netAmount: string
  invoiceNote: string
  documentNumber: string
  sellerNip: string
  documentDate: string
  category: string
  expenseCategory: string
}

type PayloadLineItemT = {
  description: string
  amount: number
  netAmount: number | undefined
  invoiceNote: string | undefined
  documentNumber: string | undefined
  sellerNip: string | undefined
  documentDate: string | undefined
  category: number | undefined
  expenseCategory: number | undefined
}

/** expenseCategory ("typ wydatku inwestycyjnego") rides only for types that use it —
 *  for a CORRECTION, only once the transfer has an investment. */
export function mapLineItem(
  item: FormLineItemT,
  type: TransferTypeT,
  hasInvestment?: boolean,
): PayloadLineItemT {
  return {
    description: item.description,
    amount: Number(item.amount),
    // On any other type a persisted netAmount would sit unread — and a later type change would
    // silently start billing it.
    netAmount: billsNetAmount(type) && item.netAmount ? Number(item.netAmount) : undefined,
    invoiceNote: item.invoiceNote || undefined,
    documentNumber: item.documentNumber.trim() || undefined,
    sellerNip: normalizeNip(item.sellerNip),
    documentDate: item.documentDate || undefined,
    // Nothing clears „Kategoria" on a type change, so without this it rides onto a transfer whose
    // form never showed the field.
    category: showsOtherCategory(type) && item.category ? Number(item.category) : undefined,
    expenseCategory:
      needsExpenseCategory(type, hasInvestment) && item.expenseCategory
        ? Number(item.expenseCategory)
        : undefined,
  }
}
