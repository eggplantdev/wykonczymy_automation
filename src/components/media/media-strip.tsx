'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FileText, ImageOff } from 'lucide-react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import { isImageMime } from '@/lib/media/mime'
import type { MediaFileT, PreviewLabelsT } from '@/types/media'

type MediaStripPropsT = {
  files: MediaFileT[]
  labels: PreviewLabelsT
  /**
   * The caller's, because the same strip renders at ~70px inside a dialog and ~265px in the wide
   * gallery — one hardcoded value over-fetches 3× in the first and upscales visibly in the second.
   */
  sizes: string
}

/** Read-only thumbnails that open the shared preview dialog on the clicked file. */
export function MediaStrip({ files, labels, sizes }: MediaStripPropsT) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {files.map((file, index) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              // The filename is the only thing telling two site photos apart, so it is the label
              // rather than a generic „otwórz".
              aria-label={file.filename ?? labels.fallbackTitle}
              className="border-input bg-muted/40 hover:border-primary/50 relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border"
            >
              {isImageMime(file.mimeType) ? (
                file.thumbnailUrl ? (
                  <Image
                    src={file.thumbnailUrl}
                    alt={file.filename ?? ''}
                    fill
                    sizes={sizes}
                    className="object-cover"
                  />
                ) : (
                  // An image uploaded before the thumbnail size existed has no rendition, and the
                  // full-size original is the wrong thing to pull into a strip of twenty.
                  <ImageOff className="text-muted-foreground size-6" />
                )
              ) : (
                <span className="text-muted-foreground flex flex-col items-center gap-1 p-2 text-center">
                  <FileText className="size-6" />
                  <span className="line-clamp-2 text-xs break-all">{file.filename}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Mounted per click so the pager starts on the thumbnail that was clicked — the dialog seeds
          its page index once, at mount. */}
      {openIndex !== null && (
        <InvoicePreviewDialog
          key={openIndex}
          invoices={files}
          initialIndex={openIndex}
          labels={labels}
          open
          onOpenChange={(next) => !next && setOpenIndex(null)}
        />
      )}
    </>
  )
}
