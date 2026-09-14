'use client'

import { useTransition } from 'react'
import type { Where } from 'payload'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastMessage } from '@/lib/utils/toast'
import { useInvoiceZip } from '@/hooks/use-invoice-zip'
import { fetchFilteredTransfers } from '@/lib/actions/fetch-transfers-for-invoices'
import { buildInvoiceArchiveName } from '@/lib/invoices/invoice-zip'
import { today } from '@/lib/utils/date'

type InvoiceDownloadButtonPropsT = {
  where: Where
}

// Fetches the rows only; packing them into the archive belongs to `useInvoiceZip`, shared with the
// kosztorys Wydatki list.
export function InvoiceDownloadButton({ where }: InvoiceDownloadButtonPropsT) {
  const { download, isPending: isZipping } = useInvoiceZip()
  // Covers the row fetch, which happens before the hook's own transition (and its toast) starts —
  // without it the button would sit enabled through the whole server action.
  const [isFetching, startTransition] = useTransition()

  function handleDownload() {
    startTransition(async () => {
      // Refetches instead of reusing the table's rows: the table is paginated, the ZIP is not.
      const result = await fetchFilteredTransfers(where)
      if (!result.success) {
        toastMessage(result.error ?? 'Nie udało się pobrać danych', 'error')
        return
      }

      const date = today()
      download(result.data, buildInvoiceArchiveName([], date))
    })
  }

  const isPending = isFetching || isZipping

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isPending}
      aria-label="Pobierz faktury"
    >
      {isPending ? <Loader2 className="animate-spin" /> : <FileArchive />}
      Faktury
    </Button>
  )
}
