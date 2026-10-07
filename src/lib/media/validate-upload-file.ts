import { isAllowedUploadMime } from '@/lib/media/sniff-mime'
import type { MessageKeyT } from '@/lib/i18n/translations'

/**
 * Names what is wrong with the picked file, or `undefined` when it is usable.
 *
 * `accept` on the picker is a hint, not a gate: drag-and-drop hands over whatever was dropped.
 */
export function uploadFileProblem(file: File): MessageKeyT<'notices'> | undefined {
  const name = file.name?.trim()
  if (!name) return 'uploadNoName'
  if (!file.type) return 'uploadNoType'
  if (file.size === 0) return 'uploadEmpty'
  if (!isAllowedUploadMime(file.type)) return 'uploadNotImageOrPdf'
  return undefined
}
