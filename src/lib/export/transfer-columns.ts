import { TRANSFER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/format-date'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { TransferTypeT, PaymentMethodT } from '@/lib/constants/transfers'

type ColumnDefT = {
  label: string
  getValue: (row: TransferRowT) => string
}

/** Shared column definitions for export (CSV) and print views. */
export const TRANSFER_EXPORT_COLUMNS: Record<string, ColumnDefT> = {
  date: { label: 'Data', getValue: (r) => formatPLDate(r.date) },
  description: { label: 'Opis', getValue: (r) => r.description },
  amount: { label: 'Kwota', getValue: (r) => formatPLN(r.amount) },
  type: {
    label: 'Typ',
    getValue: (r) => TRANSFER_TYPE_LABELS[r.type as TransferTypeT] ?? r.type,
  },
  investment: { label: 'Inwestycja', getValue: (r) => r.investmentName },
  sourceRegister: { label: 'Kasa', getValue: (r) => r.sourceRegisterName },
  targetRegister: { label: 'Kasa docelowa', getValue: (r) => r.targetRegisterName },
  otherCategory: { label: 'Kategoria', getValue: (r) => r.otherCategoryName },
  paymentMethod: {
    label: 'Metoda',
    getValue: (r) => PAYMENT_METHOD_LABELS[r.paymentMethod as PaymentMethodT] ?? r.paymentMethod,
  },
  createdBy: { label: 'Dodane przez', getValue: (r) => r.createdByName },
  createdAt: { label: 'Czas dodania', getValue: (r) => formatPLDateTime(r.createdAt) },
}

/** Columns excluded from export/print (interactive-only). */
export const EXPORT_EXCLUDED_COLUMNS = new Set(['invoice', 'invoiceNote', 'actions'])
