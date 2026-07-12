'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FileText } from 'lucide-react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'

type InvoiceThumbnailPropsT = {
  url: string
  filename: string | null
  mimeType: string | null
}

export function InvoiceThumbnail({ url, filename, mimeType }: InvoiceThumbnailPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const isImage = mimeType?.startsWith('image/')
  const displayName = filename ?? 'Faktura'

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="border-input hover:border-primary/50 group flex items-center gap-3 rounded-md border p-2 transition-colors"
        aria-label={`Podgląd: ${displayName}`}
      >
        {isImage ? (
          <div className="relative size-12 shrink-0 overflow-hidden rounded">
            <Image
              src={url}
              alt={displayName}
              fill
              sizes="48px"
              quality={50}
              className="object-cover"
            />
          </div>
        ) : (
          <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded">
            <FileText className="text-muted-foreground size-6" />
          </div>
        )}
        <span className="text-muted-foreground group-hover:text-foreground truncate text-xs transition-colors">
          {displayName}
        </span>
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
