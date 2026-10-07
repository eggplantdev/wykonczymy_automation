import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadMediaFromClient } = vi.hoisted(() => ({
  uploadMediaFromClient: vi.fn(async () => 99),
}))
vi.mock('@/lib/media/client-upload', () => ({ uploadMediaFromClient }))

import { uploadMediaBySize } from '@/lib/media/upload-media'
import { ROUTE_BODY_MAX_BYTES } from '@/lib/constants/route-body'

const photo = (size: number, name = 'paragon.jpg') =>
  new File([new Uint8Array(size)], name, { type: 'image/jpeg' })

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(Response.json({ id: 42 }))
})
afterEach(() => vi.unstubAllGlobals())

describe('uploadMediaBySize', () => {
  it('sends a file of exactly the threshold through the fast route', async () => {
    await expect(uploadMediaBySize(photo(ROUTE_BODY_MAX_BYTES), 'faktura')).resolves.toBe(42)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/media-upload')
    expect((init.body as FormData).get('kind')).toBe('faktura')
    expect(uploadMediaFromClient).not.toHaveBeenCalled()
  })

  it('leaves a larger file to the browser-to-Blob path', async () => {
    const big = photo(ROUTE_BODY_MAX_BYTES + 1)

    await expect(uploadMediaBySize(big, 'faktura')).resolves.toBe(99)

    expect(uploadMediaFromClient).toHaveBeenCalledWith(big, 'faktura')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a small', 10],
    ['a large', ROUTE_BODY_MAX_BYTES + 1],
  ])('refuses %s SVG before any bytes move', async (_, size) => {
    const svg = new File([new Uint8Array(size)], 'logo.svg', { type: 'image/svg+xml' })

    await expect(uploadMediaBySize(svg)).rejects.toMatchObject({
      messageKey: 'uploadNotImageOrPdf',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMediaFromClient).not.toHaveBeenCalled()
  })
})
