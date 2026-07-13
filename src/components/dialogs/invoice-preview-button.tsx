'use client'

import { useState } from 'react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import { InvoicePreviewTrigger } from '@/components/ui/invoice-preview-trigger'

type InvoicePreviewButtonPropsT = {
  url: string
  filename: string | null
  mimeType: string | null
}

export function InvoicePreviewButton({ url, filename, mimeType }: InvoicePreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const isImage = mimeType?.startsWith('image/') ?? false
  const displayName = filename ?? 'Faktura'

  return (
    <>
      <InvoicePreviewTrigger
        isImage={isImage}
        label={displayName}
        onClick={() => setPreviewOpen(true)}
      />

      {previewOpen && (
        <InvoicePreviewDialog
          url={url}
          filename={filename}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          // Stored file is already ingest-compressed (≤1920px, q0.6) — skip the Next optimizer
          // and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
      )}
    </>
  )
}
