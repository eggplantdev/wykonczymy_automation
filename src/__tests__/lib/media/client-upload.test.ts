import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { blobUpload } = vi.hoisted(() => ({ blobUpload: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({ upload: blobUpload }))

import { uploadMediaFromClient } from '@/lib/media/client-upload'

const pdf = (name = 'faktura.pdf') => new File(['%PDF-1.7'], name, { type: 'application/pdf' })

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  blobUpload.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/x.pdf' })
  fetchMock.mockResolvedValue(Response.json({ id: 42 }))
})
afterEach(() => vi.unstubAllGlobals())

describe('uploadMediaFromClient', () => {
  // The row has to name exactly the key the browser PUT, or the register route finds no blob.
  it('registers the blob it just PUT, under the same key', async () => {
    await expect(uploadMediaFromClient(pdf(), 'projekt')).resolves.toBe(42)

    const [key] = blobUpload.mock.calls[0]
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/media-register')
    expect(JSON.parse(init.body)).toEqual({ filename: key, kind: 'projekt' })
    expect(blobUpload.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    )
  })

  it('never asks Payload to create the row', async () => {
    await uploadMediaFromClient(pdf())

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/media-register'])
  })
})
