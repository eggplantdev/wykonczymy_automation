import type { BulkLineItemT } from '@/components/forms/expense-form/bulk-expense-form'
import { roundToCents } from '@/lib/utils/round-to-cents'

type MergedValuesT = Omit<BulkLineItemT, 'id'>

const sumText = (texts: string[]) =>
  texts.some(Boolean)
    ? String(roundToCents(texts.reduce((sum, text) => sum + Number(text), 0)))
    : ''

/**
 * Netto sums only when every row has one; a partial Netto sum would bill the investor less than he
 * owes.
 */
export function mergeLineItems(items: BulkLineItemT[]): {
  values: MergedValuesT
  isAmountIncomplete: boolean
} {
  const firstFilled = (field: keyof MergedValuesT) =>
    items.find((item) => item[field])?.[field] ?? ''
  const numbers = new Set(items.map((item) => item.documentNumber).filter(Boolean))

  return {
    values: {
      description: firstFilled('description'),
      documentDate: firstFilled('documentDate'),
      sellerNip: firstFilled('sellerNip'),
      category: firstFilled('category'),
      expenseCategory: firstFilled('expenseCategory'),
      worker: firstFilled('worker'),
      amount: sumText(items.map((item) => item.amount)),
      netAmount: items.every((item) => item.netAmount)
        ? sumText(items.map((item) => item.netAmount))
        : '',
      invoiceNote: items
        .map((item) => item.invoiceNote)
        .filter(Boolean)
        .join('\n'),
      // Several numbers name several documents; the duplicate check would match on only one of them.
      documentNumber: numbers.size === 1 ? [...numbers][0] : '',
    },
    isAmountIncomplete: items.some((item) => !item.amount),
  }
}
