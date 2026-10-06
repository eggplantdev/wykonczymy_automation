import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import type { BulkExpenseFormApiT } from '@/components/forms/expense-form/bulk-expense-form'

// Only the setter is taken, not the whole form API — it keeps the write path a pure, directly
// testable function instead of something reachable only through a rendered hook.
type SetFieldValueT = BulkExpenseFormApiT['setFieldValue']

// The stored read omits what it didn't read.
type ReceiptValuesT = {
  description?: string
  amount?: number | null
  netAmount?: number | null
  invoiceNote?: string
}

export function receiptToLineItemValues(read: ReceiptValuesT) {
  return {
    description: read.description ?? '',
    amount: read.amount == null ? '' : String(read.amount),
    netAmount: read.netAmount == null ? '' : String(read.netAmount),
    invoiceNote: read.invoiceNote ?? '',
  }
}

// Category is left blank for the user to pick — the model's category inference wasn't reliable
// enough (frequent mismatches).
//
// `netAmount` is written REGARDLESS of the transfer type, which is deliberate and looks like a
// missing `billsNetAmount` gate if you read it quickly: the type is a form-level field the user
// often picks AFTER scanning, and a filled row is permanently ineligible for re-scan, so gating
// here would leave an unrecoverable blank Netto column. `mapLineItem` already drops the value at
// submit on any type that doesn't bill netto.
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
}
