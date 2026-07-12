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
        />
      )}
    </>
  )
}
