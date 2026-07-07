import { createHmac, timingSafeEqual } from 'crypto'

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

  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(expected)

  // timingSafeEqual throws on length mismatch — guard first (also a fast reject).
  if (headerBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(headerBuf, expectedBuf)
}
