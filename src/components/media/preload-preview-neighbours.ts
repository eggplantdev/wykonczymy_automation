import { getImageProps } from 'next/image'
import { preload } from 'react-dom'
import { isImageMime, isPdfMime } from '@/lib/media/mime'
import type { PreviewFileT } from '@/types/media'

// Forward first: paging on is the common direction, and preloads start in this order.
const NEIGHBOUR_OFFSETS = [1, 2, 3, -1] as const

type PreviewImageOptionsT = { sizes: string; unoptimized?: boolean }

/**
 * Starts the downloads of the pages around the active one, so the next click paints from cache
 * instead of waiting out a cold round-trip through `/api/media/file` (0.5–0.7 s TTFB on prod,
 * 2026-10-15). One path for both kinds because a PDF has no `<Image>` to carry a `preload` prop.
 * Called during render — `preload` dedupes by URL, so a re-render costs nothing.
 *
 * A PDF neighbour is the whole file, on a phone too: the owner accepted that bandwidth for the
 * instant page turn.
 */
export function preloadPreviewNeighbours(
  files: PreviewFileT[],
  activeIndex: number,
  image: PreviewImageOptionsT,
) {
  for (const offset of NEIGHBOUR_OFFSETS) {
    const file = files[activeIndex + offset]
    if (!file || file.url.startsWith('blob:')) continue

    if (isImageMime(file.mimeType)) {
      // The same props the dialog's <Image> gets, so the preload asks for the srcset candidate the
      // browser will pick — an optimizer URL that differs only in `w` would be a second download.
      const { props } = getImageProps({ src: file.url, alt: '', fill: true, ...image })
      preload(props.src, { as: 'image', imageSrcSet: props.srcSet, imageSizes: props.sizes })
    } else if (isPdfMime(file.mimeType)) {
      // `anonymous` is fetch()'s default mode and credentials, which is what lets
      // `fetchPdfObjectUrl`'s plain fetch take over the preloaded response.
      preload(file.url, { as: 'fetch', crossOrigin: 'anonymous' })
    }
  }
}
