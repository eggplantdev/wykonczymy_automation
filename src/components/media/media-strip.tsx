'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FileText, ImageOff, Search, Trash2 } from 'lucide-react'
import { MediaPreviewDialog } from '@/components/dialogs/media-preview-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { isImageMime } from '@/lib/media/mime'
import { cn } from '@/lib/utils/cn'
import type { MediaFileT, PreviewLabelsT } from '@/types/media'

/**
 * Picking which files travel with whatever the surface is about to do, which is NOT deleting them.
 * Opt-in: a checked tile goes. The caller seeds the set, so „wszystko domyślnie" and „nic domyślnie"
 * are its decision, and the wording is its too — only it knows what the files are being picked for.
 */
type MediaStripPickT = {
  selectedIds: Set<number>
  onToggle: (file: MediaFileT) => void
  label: string
}

type MediaStripPropsT = {
  files: MediaFileT[]
  labels: PreviewLabelsT
  /**
   * The caller's, because the same strip renders at ~70px inside a dialog and ~265px in the wide
   * gallery — one hardcoded value over-fetches 3× in the first and upscales visibly in the second.
   */
  sizes: string
  /** Same reason as `sizes`, and the two have to be changed together or the fetch goes wrong. */
  gridClassName?: string
  pick?: MediaStripPickT
  /**
   * Destructive, and the caller owns the confirmation — the strip only asks for it. Typed on the id
   * alone because the same handler is reached from a tile (a `MediaFileT`) and from inside the
   * preview, which hands back the page it has on screen as its own narrower file type.
   */
  onRemove?: (file: { id?: number }, closePreview: () => void) => void
}

const OVERLAY_BUTTON =
  'bg-background/85 text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full border shadow-sm'

/** Thumbnails that open the shared preview dialog, and — with `pick` — carry their own checkbox. */
export function MediaStrip({
  files,
  labels,
  sizes,
  gridClassName = 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6',
  pick,
  onRemove,
}: MediaStripPropsT) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closePreview = () => setOpenIndex(null)

  return (
    <>
      <ul className={cn('grid gap-2', gridClassName)}>
        {files.map((file, index) => {
          const isPicked = pick?.selectedIds.has(file.id) ?? false

          return (
            <li key={file.id} className="relative">
              {/* With a checkbox on the tile the tile itself is the checkbox — hitting a 24px box on
                  a phone is the failure mode. The preview then needs its own affordance, hence the
                  explicit magnifier below; without `pick` the whole tile still opens it. */}
              <button
                type="button"
                onClick={() => (pick ? pick.onToggle(file) : setOpenIndex(index))}
                aria-pressed={pick ? isPicked : undefined}
                // The filename is the only thing telling two site photos apart, so it is the label
                // rather than a generic „otwórz".
                aria-label={file.filename ?? labels.fallbackTitle}
                className={cn(
                  'border-input bg-muted/40 hover:border-primary/50 relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border',
                  pick && !isPicked && 'opacity-60',
                  isPicked && 'border-primary ring-primary/40 ring-2',
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
              {pick && (
                <SimpleTooltip content={pick.label}>
                  <span className="absolute top-1 left-1">
                    <Checkbox
                      checked={isPicked}
                      onCheckedChange={() => pick.onToggle(file)}
                      aria-label={`${pick.label}: ${file.filename ?? labels.fallbackTitle}`}
                      className="bg-background/85 size-5"
                    />
                  </span>
                </SimpleTooltip>
              )}

              {(pick || onRemove) && (
                <div className="absolute top-1 right-1 flex gap-1">
                  {pick && (
                    <SimpleTooltip content={labels.preview}>
                      <button
                        type="button"
                        onClick={() => setOpenIndex(index)}
                        aria-label={`${labels.preview}: ${file.filename ?? labels.fallbackTitle}`}
                        className={OVERLAY_BUTTON}
                      >
                        <Search className="size-3.5" />
                      </button>
                    </SimpleTooltip>
                  )}

                  {onRemove && (
                    <SimpleTooltip content={labels.removeOneOfMany}>
                      <button
                        type="button"
                        onClick={() => onRemove(file, closePreview)}
                        aria-label={labels.removeOneOfMany}
                        className={cn(OVERLAY_BUTTON, 'hover:text-destructive')}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </SimpleTooltip>
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
        <MediaPreviewDialog
          key={openIndex}
          files={files}
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
