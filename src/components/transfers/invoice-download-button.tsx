'use client'

import { useState } from 'react'
import type { Where } from 'payload'
import { FileArchive, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { triggerDownload } from '@/lib/export/download'
import { toastMessage } from '@/components/toasts'

type InvoiceDownloadButtonPropsT = {
  where: Where
}

export function InvoiceDownloadButton({ where }: InvoiceDownloadButtonPropsT) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleDownload() {
    setIsLoading(true)
    try {
      // Fetches ALL matching transfers (unpaginated), same as Print/CSV exports —
      // the table data is paginated, so we can't use it directly.
      const result = await fetchFilteredTransfers(where)
      if (!result.success) {
        toastMessage(result.error ?? 'Nie udało się pobrać danych', 'error')
        return
      }

      const withInvoice = result.data.filter((row) => row.invoiceUrl)
      if (withInvoice.length === 0) {
        toastMessage('Brak faktur do pobrania', 'info')
        return
      }

      const zip = new JSZip()
      const usedNames = new Set<string>()

      const fetches = withInvoice.map(async (row) => {
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
        } catch {
          // skip files that fail to download
        }
      })

      await Promise.all(fetches)

      if (Object.keys(zip.files).length === 0) {
        toastMessage('Nie udało się pobrać żadnej faktury', 'error')
        return
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(zipBlob, `faktury-${date}.zip`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isLoading}
      aria-label="Pobierz faktury"
    >
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
      Faktury
    </Button>
  )
}

function buildUniqueFilename(
  date: string,
  description: string,
  originalFilename: string | null,
  usedNames: Set<string>,
): string {
  const dateStr = date.slice(0, 10).replace(/-/g, '')
  const safeDesc = sanitizeForFilename(description).slice(0, 40)
  const ext = getExtension(originalFilename)
  const base = `${dateStr}_${safeDesc}`

  let name = `${base}${ext}`
  let counter = 1
  while (usedNames.has(name)) {
    name = `${base}_${counter}${ext}`
    counter++
  }

  usedNames.add(name)
  return name
}

function sanitizeForFilename(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function getExtension(filename: string | null): string {
  if (!filename) return ''
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex) : ''
}
