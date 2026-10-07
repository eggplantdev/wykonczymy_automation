import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadMediaFromClient } = vi.hoisted(() => ({
  uploadMediaFromClient: vi.fn(async () => 99),
}))
vi.mock('@/lib/media/client-upload', () => ({ uploadMediaFromClient }))

import { UploadRefusedError } from '@/lib/media/upload-refused'
import { uploadMediaBySize, uploadMediaToServer } from '@/lib/media/upload-media'
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
    await expect(uploadMediaBySize(photo(ROUTE_BODY_MAX_BYTES), { kind: 'faktura' })).resolves.toBe(
      42,
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/media-upload')
    expect((init.body as FormData).get('kind')).toBe('faktura')
    expect(uploadMediaFromClient).not.toHaveBeenCalled()
  })

  it('leaves a larger file to the browser-to-Blob path', async () => {
    const big = photo(ROUTE_BODY_MAX_BYTES + 1)

    await expect(uploadMediaBySize(big, { kind: 'faktura' })).resolves.toBe(99)

    expect(uploadMediaFromClient).toHaveBeenCalledWith(big, { kind: 'faktura' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('uploadMediaToServer', () => {
  it.each([400, 409, 413, 415])('words a %i as the file being refused', async (status) => {
    fetchMock.mockResolvedValue(Response.json({ error: 'x' }, { status }))

    const err = await uploadMediaToServer(photo(10)).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(UploadRefusedError)
    expect(err).toMatchObject({
      messageKey: 'uploadRejected',
      messageParams: { name: 'paragon.jpg' },
    })
  })

  it('words any other failure as a failed save', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'x' }, { status: 500 }))

    await expect(uploadMediaToServer(photo(10))).rejects.toMatchObject({
      messageKey: 'uploadSaveFailed',
      messageParams: { name: 'paragon.jpg', status: 500 },
    })
  })

  it('refuses an ok response without an id', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }))

    await expect(uploadMediaToServer(photo(10))).rejects.toMatchObject({
      messageKey: 'uploadNoFileReturned',
    })
  })

  it('refuses a file the collection would not take before sending anything', async () => {
    const sheet = new File(['x'], 'arkusz.xlsx', { type: 'application/vnd.ms-excel' })

    await expect(uploadMediaToServer(sheet)).rejects.toMatchObject({
      messageKey: 'uploadNotImageOrPdf',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
