'use client'

import { useMediaRemoval, type MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import { FILE_TRASH_NOTICE } from '@/lib/media/wording'
import {
  removeAllTransferInvoicesAction,
  removeTransferInvoiceAction,
} from '@/lib/actions/transfers'
import type { PreviewFileT } from '@/types/media'

const INVOICE_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Czy na pewno chcesz usunąć tę stronę?',
  confirmLast: 'Czy na pewno chcesz usunąć fakturę?',
  confirmAll: 'Czy na pewno chcesz usunąć całą fakturę?',
  description: FILE_TRASH_NOTICE,
  error: 'Nie udało się usunąć faktury',
}

export function useInvoiceRemoval(transactionId: number, invoices: PreviewFileT[]) {
  const { visibleFiles, ...removal } = useMediaRemoval({
    files: invoices,
    removeOne: (invoiceId) => removeTransferInvoiceAction(transactionId, invoiceId),
    removeAll: () => removeAllTransferInvoicesAction(transactionId),
    labels: INVOICE_REMOVAL_LABELS,
  })

  return { visibleInvoices: visibleFiles, ...removal }
}
