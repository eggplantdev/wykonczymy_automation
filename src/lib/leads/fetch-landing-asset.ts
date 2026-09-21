import type { Payload } from 'payload'
import { serverEnv } from '@/lib/env/server'
import { uniqueFileName } from '@/lib/utils/upload-file'
import { ACCEPTED_ASSET_TYPES, MAX_ASSET_BYTES, type LandingAssetT } from './landing'

const FETCH_TIMEOUT_MS = 20_000

const isAcceptedType = (contentType: string): boolean =>
  ACCEPTED_ASSET_TYPES.some((accepted) => contentType.startsWith(accepted))

/**
 * Reject anything but an `https:` URL whose **parsed hostname equals** the landing's blob host.
 *
 * Exact equality, never `includes`/`startsWith`: `evil.com/?x=blob.vercel-storage.com` and
 * `blob.vercel-storage.com.evil.com` both pass a substring test, and the whole point of the
 * allowlist is that this handler fetches a URL a stranger chose.
 */
function assertAllowedUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Nieprawidłowy adres pliku')
  }
  if (url.protocol !== 'https:') throw new Error(`Niedozwolony protokół: ${url.protocol}`)
  if (url.hostname !== serverEnv.LANDING_BLOB_HOST) {
    throw new Error(`Niedozwolony host: ${url.hostname}`)
  }
  return url
}

/** Read the body counting bytes, so a lying `content-length` is caught mid-stream. */
async function readCapped(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Pusta odpowiedź')

  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_ASSET_BYTES) {
      await reader.cancel()
      throw new Error(`Plik przekracza ${MAX_ASSET_BYTES} B`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

/**
 * Turn one allowlisted landing blob URL into one `media` row, and return its id.
 *
 * Redirects are refused (`redirect: 'error'`) rather than followed: a redirect off the allowlisted
 * host is precisely the SSRF bypass the allowlist exists to stop, and the landing's own store never
 * needs one.
 *
 * `kind` is left unset — staff classify the file at promotion, and a guess here would be worse than
 * a blank (see `media.kind`).
 */
export async function fetchLandingAsset(payload: Payload, asset: LandingAssetT): Promise<number> {
  const url = assertAllowedUrl(asset.url)

  if (asset.size > MAX_ASSET_BYTES) throw new Error(`Plik przekracza ${MAX_ASSET_BYTES} B`)
  if (!isAcceptedType(asset.contentType)) {
    throw new Error(`Niedozwolony typ pliku: ${asset.contentType}`)
  }

  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Pobranie nie powiodło się: HTTP ${response.status}`)

  const declaredLength = Number(response.headers.get('content-length'))
  if (declaredLength > MAX_ASSET_BYTES) throw new Error(`Plik przekracza ${MAX_ASSET_BYTES} B`)

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!isAcceptedType(contentType)) throw new Error(`Niedozwolony typ pliku: ${contentType}`)

  const buffer = await readCapped(response)

  const media = await payload.create({
    collection: 'media',
    file: {
      data: buffer,
      mimetype: contentType,
      name: uniqueFileName(asset.filename),
      size: buffer.byteLength,
    },
    data: {},
    overrideAccess: true,
  })
  return media.id
}
