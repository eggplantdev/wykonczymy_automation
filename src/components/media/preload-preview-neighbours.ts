import { getImageProps } from 'next/image'
import { preload } from 'react-dom'
import { isImageMime, isPdfMime } from '@/lib/media/mime'
import type { PreviewFileT } from '@/types/media'

const NEIGHBOUR_OFFSETS = [1, 2, 3, -1] as const

type PreviewImageOptionsT = { sizes: string; unoptimized?: boolean }

/**
 * Called during render — `preload` dedupes by URL, so a re-render costs nothing.
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
