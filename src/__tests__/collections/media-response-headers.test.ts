import { describe, it, expect } from 'vitest'
import { Media } from '@/collections/media'

// EX-1021: the storage plugin serves `/api/media/file/<name>` from the app's origin with the type and
// disposition the uploading browser declared, and its token route hands out a write token to any
// session for any key — no `media` row needed. Blob stores `image/svg+xml` and `text/xml` as
// `inline`, so a `<script>` in one ran as whoever opened the link (verified on the preview store,
// 2026-10-15).

const upload = typeof Media.upload === 'object' ? Media.upload : undefined

// Mirrors what `@payloadcms/storage-vercel-blob`'s staticHandler builds from the blob's `head()`.
function serve(contentType: string, contentDisposition: string): Headers {
  const headers = new Headers()
  headers.append('Content-Disposition', contentDisposition)
  headers.append('Content-Type', contentType)
  return upload?.modifyResponseHeaders?.({ headers }) || headers
}

describe('media file response headers', () => {
  it.each(['image/svg+xml', 'text/xml', 'text/html'])(
    'a %s blob is downloaded, never rendered on our origin',
    (type) => {
      const headers = serve(type, 'inline; filename="x.pdf"')

      expect(headers.get('Content-Type')).toBe('application/octet-stream')
      expect(headers.get('Content-Disposition')).toBe('attachment')
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    },
  )

  it.each(['application/pdf', 'image/jpeg', 'image/heic'])(
    'an allowed %s still opens inline',
    (type) => {
      const headers = serve(type, 'inline; filename="faktura.pdf"')

      expect(headers.get('Content-Type')).toBe(type)
      expect(headers.get('Content-Disposition')).toBe('inline; filename="faktura.pdf"')
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    },
  )
})
