import {
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  EXPENSE_CATEGORY_LABEL,
} from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import type { TransferRowT } from '@/components/tables/transfers'
import type { TransferTypeT, PaymentMethodT } from '@/lib/constants/transfers'

type ColumnDefT = {
  label: string
  getValue: (row: TransferRowT) => string
}

/** Shared column definitions for export (CSV) and print views. */
export const TRANSFER_EXPORT_COLUMNS: Record<string, ColumnDefT> = {
  id: { label: 'ID', getValue: (r) => `#${r.id}` },
  date: { label: 'Data', getValue: (r) => formatPLDate(r.date) },
  amount: { label: 'Kwota', getValue: (r) => formatPLN(r.amount) },
  investment: { label: 'Inwestycja', getValue: (r) => r.investmentName },
  type: {
    label: 'Typ',
    getValue: (r) => TRANSFER_TYPE_LABELS[r.type as TransferTypeT] ?? r.type,
  },
  expenseCategory: {
    label: EXPENSE_CATEGORY_LABEL,
    getValue: (r) => r.expenseCategoryName,
  },
  description: { label: 'Opis', getValue: (r) => r.description },
  otherCategory: { label: 'Kategoria (inne wydatki)', getValue: (r) => r.otherCategoryName },
  invoice: { label: 'Faktura', getValue: (r) => r.invoiceUrl ?? '' },
  invoiceNote: { label: 'Notatka', getValue: (r) => r.invoiceNote ?? '' },
  sourceRegister: { label: 'Kasa źródłowa', getValue: (r) => r.sourceRegisterName },
  targetRegister: { label: 'Kasa docelowa', getValue: (r) => r.targetRegisterName },
  paymentMethod: {
    label: 'Metoda',
    getValue: (r) => PAYMENT_METHOD_LABELS[r.paymentMethod as PaymentMethodT] ?? r.paymentMethod,
  },
  worker: { label: 'Pracownik', getValue: (r) => r.workerName },
  createdBy: { label: 'Dodane przez', getValue: (r) => r.createdByName },
  createdAt: { label: 'Czas dodania', getValue: (r) => formatPLDateTime(r.createdAt) },
}
