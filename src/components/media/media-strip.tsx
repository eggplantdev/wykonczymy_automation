'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FileText, ImageOff, RotateCcw, Trash2, X } from 'lucide-react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import { isImageMime } from '@/lib/media/mime'
import { cn } from '@/lib/utils/cn'
import type { MediaFileT, PreviewLabelsT } from '@/types/media'

/**
 * Holding a file back from whatever the surface is about to create, which is NOT deleting it — the
 * wording is the caller's because only the caller knows what the file is being held back from.
 */
type MediaStripExcludeT = {
  excludedIds: Set<number>
  onToggle: (file: MediaFileT) => void
  labels: { exclude: string; restore: string }
}

type MediaStripPropsT = {
  files: MediaFileT[]
  labels: PreviewLabelsT
  /**
   * The caller's, because the same strip renders at ~70px inside a dialog and ~265px in the wide
   * gallery — one hardcoded value over-fetches 3× in the first and upscales visibly in the second.
   */
  sizes: string
  exclude?: MediaStripExcludeT
  /**
   * Destructive, and the caller owns the confirmation — the strip only asks for it. Typed on the id
   * alone because the same handler is reached from a tile (a `MediaFileT`) and from inside the
   * preview, which hands back the page it has on screen as its own narrower file type.
   */
  onRemove?: (file: { id?: number }, closePreview: () => void) => void
}

const OVERLAY_BUTTON =
  'bg-background/85 text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-full border shadow-sm'

/** Thumbnails that open the shared preview dialog on the clicked file. */
export function MediaStrip({ files, labels, sizes, exclude, onRemove }: MediaStripPropsT) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closePreview = () => setOpenIndex(null)

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {files.map((file, index) => {
          const isExcluded = exclude?.excludedIds.has(file.id) ?? false

          return (
            <li key={file.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                // The filename is the only thing telling two site photos apart, so it is the label
                // rather than a generic „otwórz".
                aria-label={file.filename ?? labels.fallbackTitle}
                className={cn(
                  'border-input bg-muted/40 hover:border-primary/50 relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border',
                  // Dimmed rather than hidden: the point of excluding a file is to keep seeing that
                  // you did it, and to be able to put it back.
                  isExcluded && 'opacity-35 grayscale',
                )}
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

              {/* Siblings of the tile, not children: the tile is itself a button and a button
                  inside a button is invalid markup that browsers silently reparent. */}
              {(exclude || onRemove) && (
                <div className="absolute top-1 right-1 flex gap-1">
                  {exclude && (
                    <button
                      type="button"
                      onClick={() => exclude.onToggle(file)}
                      aria-label={isExcluded ? exclude.labels.restore : exclude.labels.exclude}
                      className={OVERLAY_BUTTON}
                    >
                      {isExcluded ? <RotateCcw className="size-3.5" /> : <X className="size-3.5" />}
                    </button>
                  )}

                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(file, closePreview)}
                      aria-label={labels.removeOneOfMany}
                      className={cn(OVERLAY_BUTTON, 'hover:text-destructive')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
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
          onRemove={onRemove && ((invoice) => onRemove(invoice, closePreview))}
        />
      )}
    </>
  )
}
