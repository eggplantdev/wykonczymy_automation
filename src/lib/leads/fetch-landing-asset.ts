import type { Payload } from 'payload'
import { serverEnv } from '@/lib/env/server'
import {
  isAllowedContentType,
  isAllowedUploadMime,
  normalizeContentType,
} from '@/lib/media/sniff-mime'
import { uniqueFileName } from '@/lib/utils/unique-file-name'
import type { LandingAssetT } from './landing'

/**
 * The route budgets `MAX_LANDING_ASSETS × FETCH_TIMEOUT_MS` against its own `maxDuration`, so
 * raising either one without the other is what puts the handler back over the platform ceiling.
 */
export const FETCH_TIMEOUT_MS = 15_000
export const MAX_ASSET_BYTES = 8 * 1024 * 1024

/**
 * Exact equality, never `includes`/`startsWith`: `evil.com/?x=blob.vercel-storage.com` and
 * `blob.vercel-storage.com.evil.com` both pass a substring test
 */
function assertAllowedUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Nieprawidłowy adres pliku')
  }
  if (url.protocol !== 'https:') throw new Error(`Niedozwolony protokół: ${url.protocol}`)
  if (url.hostname !== serverEnv.LANDING_BLOB_HOST.toLowerCase()) {
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
 * Redirects are refused (`redirect: 'error'`): a redirect off the allowlisted host is precisely the
 * SSRF bypass the allowlist exists to stop.
 */
export async function fetchLandingAsset(payload: Payload, asset: LandingAssetT): Promise<number> {
  const url = assertAllowedUrl(asset.url)

  if (asset.size > MAX_ASSET_BYTES) throw new Error(`Plik przekracza ${MAX_ASSET_BYTES} B`)
  // Checked before the fetch as well as by Payload's create: a type the collection refuses would
  // otherwise cost 8 MB of transfer and an alert naming the wrong cause.
  if (!isAllowedContentType(asset.contentType)) {
    throw new Error(`Niedozwolony typ pliku: ${asset.contentType}`)
  }

  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Pobranie nie powiodło się: HTTP ${response.status}`)

  const declaredLength = Number(response.headers.get('content-length'))
  if (declaredLength > MAX_ASSET_BYTES) throw new Error(`Plik przekracza ${MAX_ASSET_BYTES} B`)

  const contentType = normalizeContentType(response.headers.get('content-type') ?? '')
  if (!isAllowedUploadMime(contentType)) throw new Error(`Niedozwolony typ pliku: ${contentType}`)

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
