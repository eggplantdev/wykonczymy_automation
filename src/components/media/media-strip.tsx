'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FileText, ImageOff } from 'lucide-react'
import { RemoveButton } from '@/components/ui/remove-button'
import {
  InvoicePreviewDialog,
  type PreviewLabelsT,
} from '@/components/dialogs/invoice-preview-dialog'
import { isImageMime } from '@/lib/media/mime'
import type { MediaFileT } from '@/types/media'

type MediaStripPropsT = {
  files: MediaFileT[]
  labels: PreviewLabelsT
  emptyText: string
  /**
   * The caller's, because the same strip renders at ~70px inside a dialog and ~265px in the wide
   * gallery — one hardcoded value over-fetches 3× in the first and upscales visibly in the second.
   */
  sizes: string
  /** Omitted where the strip is read-only — the lead's files belong to the submission, not to us. */
  onRemove?: (file: MediaFileT) => void
  removeDisabled?: boolean
}

/**
 * Thumbnails that open the shared preview dialog on the clicked file. Removal is the caller's,
 * which is the whole difference between the investment's gallery and a lead's read-only strip.
 */
export function MediaStrip({
  files,
  labels,
  emptyText,
  sizes,
  onRemove,
  removeDisabled,
}: MediaStripPropsT) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (files.length === 0) return <p className="text-muted-foreground text-sm">{emptyText}</p>

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {files.map((file, index) => (
          <li key={file.id} className="group relative">
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

            {onRemove && (
              <RemoveButton
                onClick={() => onRemove(file)}
                disabled={removeDisabled}
                aria-label={`Usuń ${file.filename ?? 'plik'}`}
                className="bg-background/80 absolute top-1 right-1"
              />
            )}
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
