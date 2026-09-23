'use client'

import { useTransition } from 'react'
import type { Where } from 'payload'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastMessage } from '@/lib/utils/toast'
import { useFileArchive } from '@/hooks/use-file-archive'
import { fetchFilteredTransfers } from '@/lib/actions/fetch-transfers-for-invoices'
import { INVOICE_ARCHIVE_COPY } from '@/lib/media/wording'

type InvoiceDownloadButtonPropsT = {
  where: Where
}

// Fetches the rows only; packing them into the archive belongs to `useFileArchive`, shared with the
// kosztorys Wydatki list.
export function InvoiceDownloadButton({ where }: InvoiceDownloadButtonPropsT) {
  const { download, isPending: isZipping } = useFileArchive()
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

      download(result.data, [], INVOICE_ARCHIVE_COPY)
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
