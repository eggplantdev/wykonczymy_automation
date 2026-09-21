'use client'

import { useMediaRemoval, type MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import {
  removeAllTransferInvoicesAction,
  removeTransferInvoiceAction,
} from '@/lib/actions/transfers'
import type { InvoiceFileT } from '@/types/transfers'

const INVOICE_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Czy na pewno chcesz usunąć tę stronę?',
  // Removing the only page removes the invoice — say that, rather than „stronę" for a single photo.
  confirmLast: 'Czy na pewno chcesz usunąć fakturę?',
  confirmAll: 'Czy na pewno chcesz usunąć całą fakturę?',
  error: 'Nie udało się usunąć faktury',
}

/**
 * The invoice preset over `useMediaRemoval`, shared by every surface that shows the preview with a
 * „usuń" affordance (the transfers cell, the edit form).
 */
export function useInvoiceRemoval(transactionId: number, invoices: InvoiceFileT[]) {
  const { visibleFiles, handleRemove, handleRemoveAll, removalConfirm } = useMediaRemoval({
    files: invoices,
    removeOne: (invoiceId) => removeTransferInvoiceAction(transactionId, invoiceId),
    removeAll: () => removeAllTransferInvoicesAction(transactionId),
    labels: INVOICE_REMOVAL_LABELS,
  })

  return { visibleInvoices: visibleFiles, handleRemove, handleRemoveAll, removalConfirm }
}
