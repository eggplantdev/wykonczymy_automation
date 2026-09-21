import { createHmac, timingSafeEqual } from 'crypto'

/**
 * The `sha256=…` header value for a body, under a shared secret. One function for both directions:
 * we verify Meta's and the landing's inbound headers with it, and sign our own outbound callback to
 * the landing with it — so a change to the scheme cannot land on one side only.
 */
export function signBody(rawBody: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

/**
 * Verify Meta's `X-Hub-Signature-256` header against the RAW request body.
 * The HMAC must be computed over the exact bytes Meta signed, so callers pass
 * the raw text (never a re-serialized `JSON.stringify`, which can differ).
 */
export function verifySignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!header || !header.startsWith('sha256=')) return false

  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(signBody(rawBody, secret))

  // timingSafeEqual throws on length mismatch — guard first (also a fast reject).
  if (headerBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(headerBuf, expectedBuf)
}
