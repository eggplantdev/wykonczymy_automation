import { isAllowedContentType } from '@/lib/media/sniff-mime'

/**
 * `/api/media/file/<name>` is served from the app's origin with whatever type the uploading browser
 * declared, and the storage plugin's token route lets any session put a blob under any free key —
 * no row needed (EX-1021). Blob stores `image/svg+xml` and `text/xml` as `inline`, and Blob's own
 * CDN CSP does not travel through the plugin's staticHandler, so a type off the upload allowlist is
 * forced to download instead of rendering as a page that runs with the viewer's session.
 */
export function hardenMediaFileHeaders({ headers }: { headers: Headers }): Headers {
  headers.set('X-Content-Type-Options', 'nosniff')
  if (!isAllowedContentType(headers.get('Content-Type') ?? '')) {
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Content-Disposition', 'attachment')
  }
  return headers
}
