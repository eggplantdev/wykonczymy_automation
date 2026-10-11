import type { SubmitConfirmCopyT } from '@/components/forms/hooks/use-submit-confirm'

// Neutral, and it never refuses: a purchase with no document still happened and has to be bookable.
const MISSING_INVOICE_COPY = {
  title: 'Brak faktury',
  confirmLabel: 'Zapisz bez faktury',
  cancelLabel: 'Popraw',
  variant: 'neutral',
} as const

export const MISSING_TRANSFER_INVOICE_CONFIRM: SubmitConfirmCopyT = {
  ...MISSING_INVOICE_COPY,
  description: 'Ta transakcja nie ma załączonej faktury.',
}

export function missingInvoiceConfirm(
  rows: { description: string }[],
  rowsWithInvoice: { has(index: number): boolean },
): SubmitConfirmCopyT | null {
  const missing = rows.flatMap((row, index) =>
    rowsWithInvoice.has(index) ? [] : [row.description.trim() || `Pozycja ${index + 1}`],
  )
  if (missing.length === 0) return null

  const description =
    rows.length === 1
      ? 'Ta pozycja nie ma załączonej faktury.'
      : `Bez faktury: ${missing.join(', ')} (${missing.length} z ${rows.length}).`
  return { ...MISSING_INVOICE_COPY, description }
}
