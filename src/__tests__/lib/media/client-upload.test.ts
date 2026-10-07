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
    await expect(uploadMediaFromClient(pdf(), { kind: 'projekt' })).resolves.toBe(42)

    const [key] = blobUpload.mock.calls[0]
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/media-register')
    expect(JSON.parse(init.body)).toEqual({ filename: key, kind: 'projekt' })
    expect(blobUpload.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    )
  })

  // `POST /api/media` is the serialized Payload pipeline EX-855 had to queue; no app path uses it.
  it('never asks Payload to create the row', async () => {
    await uploadMediaFromClient(pdf())

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/media-register'])
  })

  it.each([400, 409, 415])('words a %i as the file being refused', async (status) => {
    fetchMock.mockResolvedValue(Response.json({ error: 'x' }, { status }))

    await expect(uploadMediaFromClient(pdf())).rejects.toMatchObject({
      messageKey: 'uploadRejected',
      messageParams: { name: 'faktura.pdf' },
    })
  })

  it('words any other failure as a failed save', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'x' }, { status: 500 }))

    await expect(uploadMediaFromClient(pdf())).rejects.toMatchObject({
      messageKey: 'uploadSaveFailed',
      messageParams: { name: 'faktura.pdf', status: 500 },
    })
  })

  it('refuses an SVG before any bytes move', async () => {
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })

    await expect(uploadMediaFromClient(svg)).rejects.toMatchObject({
      messageKey: 'uploadNotImageOrPdf',
    })
    expect(blobUpload).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
