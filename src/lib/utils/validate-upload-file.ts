import { isPreviewableMime } from '@/lib/media/mime'
import type { MessageKeyT } from '@/lib/i18n/translations'

/**
 * Names what is wrong with the picked file, or `undefined` when it is usable.
 *
 * Since the bytes now reach Blob BEFORE the row is created, a type the collection refuses would
 * otherwise leave a banked blob with no `media` row — and the orphan cleanup deletes rows, so
 * nothing could ever find it. `accept` on the picker is a hint, not a gate: drag-and-drop hands
 * over whatever was dropped.
 */
export function uploadFileProblem(file: File): MessageKeyT<'notices'> | undefined {
  const name = file.name?.trim()
  if (!name) return 'uploadNoName'
  if (!file.type) return 'uploadNoType'
  if (file.size === 0) return 'uploadEmpty'
  // `isPreviewableMime` mirrors `media.upload.mimeTypes` — image/* or PDF.
  if (!isPreviewableMime(file.type)) return 'uploadNotImageOrPdf'
  return undefined
}
