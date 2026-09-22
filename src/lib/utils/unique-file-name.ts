import { sanitizeFileName } from '@/lib/utils/sanitize-filename'
import { appendShortId, splitExtension } from '@/lib/utils/append-short-id'

/**
 * Collision-proof stored name. Its own module because the client-upload path runs it in the
 * browser: the blob key is minted there, and it has to equal the `filename` the media row carries.
 */
export function uniqueFileName(rawName: string): string {
  const { base, ext } = splitExtension(sanitizeFileName(rawName) || 'upload')
  return appendShortId(base, ext)
}
