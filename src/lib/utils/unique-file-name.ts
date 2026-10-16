import { sanitizeFileName } from '@/lib/utils/sanitize-filename'
import { appendShortId, splitExtension } from '@/lib/utils/append-short-id'

// Its own module because the client-upload path runs it in the browser.
export function uniqueFileName(rawName: string): string {
  const { base, ext } = splitExtension(sanitizeFileName(rawName) || 'upload')
  return appendShortId(base, ext)
}
