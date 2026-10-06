import { describe, it, expect, vi, afterEach } from 'vitest'
import { blobPublicUrl, blobStoreIdOf, fetchMediaBytes } from '@/lib/media/blob-public-url'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('blobStoreIdOf', () => {
  it('reads the store a token names', () => {
    expect(blobStoreIdOf('vercel_blob_rw_rNjU0fDb7Sz8bHVA_secretPart')).toBe('rNjU0fDb7Sz8bHVA')
  })

  it('is undefined for a token of another shape', () => {
    expect(blobStoreIdOf('not-a-blob-token')).toBeUndefined()
  })
})

describe('blobPublicUrl', () => {
  // Filenames predate sanitizeFileName; a raw space or `#` would build a URL to another object.
  it('encodes the filename into one path segment', () => {
    expect(blobPublicUrl('store1', 'faktura #3 ąę.jpg')).toBe(
      'https://store1.public.blob.vercel-storage.com/faktura%20%233%20%C4%85%C4%99.jpg',
    )
  })
})

describe('fetchMediaBytes', () => {
  it('returns the bytes as a receipt page under the media’s own type and name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([7, 8]), { status: 200 })),
    )

    const page = await fetchMediaBytes('store1', { filename: 'a.pdf', mimeType: 'application/pdf' })

    expect(Array.from(page.bytes)).toEqual([7, 8])
    expect(page).toMatchObject({ mediaType: 'application/pdf', filename: 'a.pdf' })
  })

  it('throws on a missing object instead of handing the model an error page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 })),
    )

    await expect(
      fetchMediaBytes('store1', { filename: 'gone.jpg', mimeType: 'image/jpeg' }),
    ).rejects.toThrow('404')
  })
})
