'use client'

import { useRef, useTransition } from 'react'
import type { Where } from 'payload'
import { FileArchive, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { triggerDownload } from '@/lib/export/download'
import { buildUniqueFilename, pluralizeInvoice } from '@/lib/export/invoice-zip'
import { toastMessage } from '@/lib/utils/toast'

type InvoiceDownloadButtonPropsT = {
  where: Where
}

export function InvoiceDownloadButton({ where }: InvoiceDownloadButtonPropsT) {
  const [isPending, startTransition] = useTransition()
  const toastIdRef = useRef<string | number | null>(null)

  function handleDownload() {
    startTransition(async () => {
      toastIdRef.current = toast.info('Pobieranie faktur...', {
        autoClose: false,
        position: 'bottom-center',
        theme: 'dark',
      })

      try {
        // Fetches ALL matching transfers (unpaginated), same as Print/CSV exports —
        // the table data is paginated, so we can't use it directly.
        const result = await fetchFilteredTransfers(where)
        if (!result.success) {
          updateToast(toastIdRef.current, result.error ?? 'Nie udało się pobrać danych', 'error')
          return
        }

        const withInvoice = result.data.filter((row) => row.invoiceUrl)
        if (withInvoice.length === 0) {
          updateToast(toastIdRef.current, 'Brak faktur do pobrania', 'info')
          return
        }

        updateToast(
          toastIdRef.current,
          `Pobieranie 0/${withInvoice.length} faktur...`,
          'info',
          false,
        )

        const zip = new JSZip()
        const usedNames = new Set<string>()
        let downloaded = 0

        // Fetch files in batches to avoid overwhelming the browser with hundreds of parallel requests
        const BATCH_SIZE = 6
        for (let i = 0; i < withInvoice.length; i += BATCH_SIZE) {
          const batch = withInvoice.slice(i, i + BATCH_SIZE)
          await Promise.all(
            batch.map(async (row) => {
              try {
                const response = await fetch(row.invoiceUrl!)
                if (!response.ok) return

                const blob = await response.blob()
                const name = buildUniqueFilename(
                  row.date,
                  row.description,
                  row.invoiceFilename,
                  usedNames,
                )
                zip.file(name, blob)
                downloaded++
                updateToast(
                  toastIdRef.current,
                  `Pobieranie ${downloaded}/${withInvoice.length} faktur...`,
                  'info',
                  false,
                )
              } catch {
                // skip files that fail to download
              }
            }),
          )
        }

        if (downloaded === 0) {
          updateToast(toastIdRef.current, 'Nie udało się pobrać żadnej faktury', 'error')
          return
        }

        updateToast(toastIdRef.current, 'Tworzenie archiwum ZIP...', 'info', false)

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const date = new Date().toISOString().slice(0, 10)
        triggerDownload(zipBlob, `faktury-${date}.zip`)

        updateToast(
          toastIdRef.current,
          `Pobrano ${downloaded} ${pluralizeInvoice(downloaded)}`,
          'success',
        )
      } catch {
        updateToast(toastIdRef.current, 'Wystąpił nieoczekiwany błąd', 'error')
      }
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isPending}
      aria-label="Pobierz faktury"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
      Faktury
    </Button>
  )
}

function updateToast(
  id: string | number | null,
  message: string,
  type: 'info' | 'success' | 'error',
  autoClose: number | false = 2000,
) {
  if (id === null) {
    toastMessage(message, type)
    return
  }
  toast.update(id, { render: message, type, autoClose, theme: 'dark' })
}
