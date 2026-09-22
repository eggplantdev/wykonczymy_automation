'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Minus, Plus, Scan } from 'lucide-react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { Spinner } from '@/components/ui/loader/spinner'

type ZoomablePreviewImagePropsT = {
  src: string
  alt: string
  sizes: string
  /** A local `blob:` URL (a file not uploaded yet) can't go through the optimizer at any scale. */
  unoptimized?: boolean
  onLoad?: () => void
  onError?: () => void
}

const MAX_SCALE = 8

/**
 * Knows nothing about which page is on screen — the dialog keeps `pageIndex` and remounts this
 * component per page, which is also how zoom resets: the next file has different dimensions, so a
 * carried-over scale would open it cropped at a random spot.
 */
export function ZoomablePreviewImage({
  src,
  alt,
  sizes,
  unoptimized,
  onLoad,
  onError,
}: ZoomablePreviewImagePropsT) {
  // At scale 1 the optimized rendition is the right trade; past it, magnifying a rendition only
  // magnifies its artefacts, so the first zoom swaps in the full-size original. One-way for the
  // lifetime of this page — flipping back on every return to 1× would re-download both layers.
  const [hasZoomed, setHasZoomed] = useState(false)
  // The swap points the same <img> at a different URL, so the browser drops the rendition it was
  // showing: without these two the window is blank for the whole download, and blank forever if it
  // 404s. A failure falls back to the rendition, which is already in cache.
  const [isOriginalLoading, setIsOriginalLoading] = useState(false)
  const [hasOriginalFailed, setHasOriginalFailed] = useState(false)

  const showsOriginal = hasZoomed && !hasOriginalFailed

  function startZoom() {
    if (hasZoomed || hasOriginalFailed) return
    setHasZoomed(true)
    setIsOriginalLoading(true)
  }

  return (
    <TransformWrapper
      minScale={1}
      maxScale={MAX_SCALE}
      doubleClick={{ mode: 'toggle' }}
      wheel={{ step: 0.2 }}
      // Covers wheel, pinch and double-click.
      onTransform={(_ref, state) => {
        if (state.scale > 1) startZoom()
      }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          {/* Sized through the library's own style props, not classes: it injects its own stylesheet
              at runtime — after Tailwind's — so at equal specificity its `fit-content` beats
              `h-full w-full`, and `<Image fill>` is absolute, so that box collapses to nothing and
              takes the image with it. */}
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}
            contentStyle={{ width: '100%', height: '100%' }}
          >
            <div className="relative h-full w-full">
              <Image
                src={src}
                alt={alt}
                fill
                sizes={sizes}
                unoptimized={unoptimized || showsOriginal}
                className="object-contain"
                onLoad={() => {
                  setIsOriginalLoading(false)
                  onLoad?.()
                }}
                onError={() => {
                  setIsOriginalLoading(false)
                  if (showsOriginal) setHasOriginalFailed(true)
                  else onError?.()
                }}
              />
            </div>
          </TransformComponent>

          {isOriginalLoading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <Spinner />
            </div>
          )}

          {hasOriginalFailed && (
            <p className="bg-background/85 text-muted-foreground absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md border px-3 py-1 text-sm shadow-sm">
              Nie udało się wczytać oryginału — widok pozostaje w jakości podglądu.
            </p>
          )}

          {/* Overlaid rather than placed by the pager, which only exists on a multi-page set. */}
          <div className="bg-background/85 absolute right-2 bottom-2 z-10 flex gap-1 rounded-md border p-1 shadow-sm">
            {[
              { icon: Minus, label: 'Oddal', onClick: () => zoomOut() },
              // Says it on its own click too: a transform callback can only report a scale the
              // layout was able to compute.
              {
                icon: Plus,
                label: 'Przybliż',
                onClick: () => {
                  startZoom()
                  zoomIn()
                },
              },
              { icon: Scan, label: 'Dopasuj do okna', onClick: () => resetTransform() },
            ].map(({ icon, label, onClick }) => (
              // Wider than a row action: this one is a touch target floating over an image.
              <RowActionButton
                key={label}
                icon={icon}
                label={label}
                className="size-8"
                onClick={onClick}
              />
            ))}
          </div>
        </>
      )}
    </TransformWrapper>
  )
}
