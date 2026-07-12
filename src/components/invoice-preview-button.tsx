'use client'

import { useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'

type InvoicePreviewButtonPropsT = {
  url: string
  filename: string | null
  mimeType: string | null
}

export function InvoicePreviewButton({ url, filename, mimeType }: InvoicePreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const isImage = mimeType?.startsWith('image/')
  const displayName = filename ?? 'Faktura'

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        aria-label={`Podgląd: ${displayName}`}
        className="border-input text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/50 flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors"
      >
        {isImage ? (
          <Search className="size-4 shrink-0" />
        ) : (
          <FileText className="size-4 shrink-0" />
        )}
        <span className="truncate text-sm">{displayName}</span>
      </button>

      {previewOpen && (
        <InvoicePreviewDialog
          url={url}
          filename={filename}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </>
  )
}
