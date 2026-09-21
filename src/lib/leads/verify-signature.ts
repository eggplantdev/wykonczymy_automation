import { createHmac, timingSafeEqual } from 'crypto'

/**
 * What a signature is FOR. The signing key is derived from the shared secret AND this scope, so a
 * signature minted for one purpose can never verify as another.
 *
 * The concrete hole this closes: an inbound landing envelope carries a `submissionId`, and the
 * cleanup callback's whole body IS a `submissionId` — so under one undifferentiated key, any copy
 * of a signed submission (the landing's retry queue, a log, a stored payload) was also a valid,
 * never-expiring „delete this submission's files" instruction. It also makes the signature layer
 * refuse a request our own code sends to the wrong endpoint, which it previously waved through.
 *
 * `meta` is the exception and derives nothing: Meta computes `X-Hub-Signature-256` with the raw app
 * secret, and that scheme is not ours to change.
 */
export type SignatureScopeT = 'meta' | 'landing-submission' | 'landing-cleanup'

const keyFor = (secret: string, scope: SignatureScopeT) =>
  scope === 'meta' ? secret : createHmac('sha256', secret).update(scope, 'utf8').digest()

/**
 * The `sha256=…` header value for a body. One function for both directions: we verify Meta's and
 * the landing's inbound headers with it, and sign our own outbound callback to the landing with it
 * — so a change to the scheme cannot land on one side only.
 */
export function signBody(rawBody: string, secret: string, scope: SignatureScopeT): string {
  return (
    'sha256=' + createHmac('sha256', keyFor(secret, scope)).update(rawBody, 'utf8').digest('hex')
  )
}

/**
 * Verify an inbound webhook's signature header against the RAW request body — Meta's
 * `X-Hub-Signature-256` and the landing's `x-landing-signature` are the same scheme, differing only
 * in scope. The HMAC must be computed over the exact bytes the sender signed, so callers pass the
 * raw text (never a re-serialized `JSON.stringify`, which can differ).
 */
export function verifySignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  scope: SignatureScopeT,
): boolean {
  if (!header || !header.startsWith('sha256=')) return false

  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(signBody(rawBody, secret, scope))

  // timingSafeEqual throws on length mismatch — guard first (also a fast reject).
  if (headerBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(headerBuf, expectedBuf)
}
