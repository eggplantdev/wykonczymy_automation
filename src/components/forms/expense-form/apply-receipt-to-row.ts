import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'

type SetFieldValueT = BulkExpenseFormApiT['setFieldValue']

type ReceiptValuesT = {
  description?: string
  amount?: number | null
  netAmount?: number | null
  invoiceNote?: string
  documentNumber?: string
  sellerNip?: string
  documentDate?: string
}

export function receiptToLineItemValues(read: ReceiptValuesT) {
  return {
    description: read.description ?? '',
    amount: read.amount == null ? '' : String(read.amount),
    netAmount: read.netAmount == null ? '' : String(read.netAmount),
    invoiceNote: read.invoiceNote ?? '',
    documentNumber: read.documentNumber ?? '',
    sellerNip: read.sellerNip ?? '',
    documentDate: read.documentDate ?? '',
  }
}

// `netAmount` is written REGARDLESS of the transfer type: the type is a form-level field the user
// often picks AFTER scanning, and a filled row is skipped by the bulk re-scan, so gating here would
// leave a blank Netto column only a per-row re-read could fill.
export function applyReceiptToRow(
  setFieldValue: SetFieldValueT,
  index: number,
  data: ReceiptFillResultT,
) {
  const values = receiptToLineItemValues(data)
  setFieldValue(`lineItems[${index}].description`, values.description)
  setFieldValue(`lineItems[${index}].amount`, values.amount)
  setFieldValue(`lineItems[${index}].netAmount`, values.netAmount)
  setFieldValue(`lineItems[${index}].invoiceNote`, values.invoiceNote)
  setFieldValue(`lineItems[${index}].documentNumber`, values.documentNumber)
  setFieldValue(`lineItems[${index}].sellerNip`, values.sellerNip)
  setFieldValue(`lineItems[${index}].documentDate`, values.documentDate)
}
