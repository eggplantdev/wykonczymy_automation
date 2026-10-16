import { createHmac, timingSafeEqual } from 'crypto'

/**
 * The signing key is derived from the shared secret AND this scope, so a
 * signature minted for one purpose can never verify as another.
 *
 * `meta` is the exception and derives nothing: Meta computes `X-Hub-Signature-256` with the raw app
 * secret.
 */
export type SignatureScopeT = 'meta' | 'landing-submission' | 'landing-cleanup'

const keyFor = (secret: string, scope: SignatureScopeT) =>
  scope === 'meta' ? secret : createHmac('sha256', secret).update(scope, 'utf8').digest()

export function signBody(rawBody: string, secret: string, scope: SignatureScopeT): string {
  return (
    'sha256=' + createHmac('sha256', keyFor(secret, scope)).update(rawBody, 'utf8').digest('hex')
  )
}

/**
 * The HMAC must be computed over the exact bytes the sender signed, so callers pass the
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
