'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Minus, Plus, Scan } from 'lucide-react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'

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
 * The preview's image, zoomable by wheel, pinch, double-click and the three buttons. It knows
 * nothing about which page is on screen — the dialog keeps `pageIndex` and remounts this component
 * per page, which is also how zoom resets: the next file has different dimensions, so a carried-over
 * scale would open it cropped at a random spot.
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

  return (
    <TransformWrapper
      minScale={1}
      maxScale={MAX_SCALE}
      doubleClick={{ mode: 'toggle' }}
      wheel={{ step: 0.2 }}
      // Covers wheel, pinch and double-click; the button says the same thing on its own click,
      // because a transform callback can only report a scale the layout was able to compute.
      onTransform={(_ref, state) => {
        if (state.scale > 1) setHasZoomed(true)
      }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          {/* Sized through the library's own style props, not classes: it writes inline styles on
              both elements, and `<Image fill>` is absolute — a content box of `fit-content` would
              collapse to nothing and take the image with it. */}
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
                unoptimized={unoptimized || hasZoomed}
                className="object-contain"
                onLoad={onLoad}
                onError={onError}
              />
            </div>
          </TransformComponent>

          {/* Overlaid rather than placed by the pager, which only exists on a multi-page set. Always
              visible: a gesture nobody can see is a feature nobody finds. */}
          <div className="bg-background/85 absolute right-2 bottom-2 z-10 flex gap-1 rounded-md border p-1 shadow-sm">
            <SimpleTooltip content="Oddal">
              <Button variant="ghost" size="icon" onClick={() => zoomOut()} aria-label="Oddal">
                <Minus />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Przybliż">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setHasZoomed(true)
                  void zoomIn()
                }}
                aria-label="Przybliż"
              >
                <Plus />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Dopasuj do okna">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => resetTransform()}
                aria-label="Dopasuj do okna"
              >
                <Scan />
              </Button>
            </SimpleTooltip>
          </div>
        </>
      )}
    </TransformWrapper>
  )
}
