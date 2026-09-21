'use client'

import { addTransferInvoicesAction } from '@/lib/actions/transfers'
import { useMediaUpload } from '@/hooks/use-media-upload'

export function useInvoiceUpload(transactionId: number) {
  return useMediaUpload({
    attach: (pageIds) => addTransferInvoicesAction(transactionId, pageIds),
    successMessage: 'Faktura dodana',
  })
}
