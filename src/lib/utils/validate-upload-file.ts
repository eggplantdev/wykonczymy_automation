import { isPreviewableMime } from '@/lib/media/mime'

/**
 * Returns a Polish error message, or `''` when the picked file is usable.
 *
 * Since the bytes now reach Blob BEFORE the row is created, a type the collection refuses would
 * otherwise leave a banked blob with no `media` row — and the orphan cleanup deletes rows, so
 * nothing could ever find it. `accept` on the picker is a hint, not a gate: drag-and-drop hands
 * over whatever was dropped.
 */
export function validateUploadFile(file: File): string {
  const name = file.name?.trim()
  if (!name) return 'Plik nie ma nazwy'
  if (!file.type) return 'Nierozpoznany typ pliku'
  if (file.size === 0) return 'Plik jest pusty'
  // `isPreviewableMime` mirrors `media.upload.mimeTypes` — image/* or PDF.
  if (!isPreviewableMime(file.type)) return 'Dozwolone są tylko zdjęcia i pliki PDF'
  return ''
}
