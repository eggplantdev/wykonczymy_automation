import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateTag } from '@/__tests__/stubs/next-cache'

vi.mock('server-only', () => ({}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({})) }))

const mockGetUser = vi.fn()
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: () => mockGetUser(),
}))

const mockPut = vi.fn()
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
}))

const mockInsert = vi.fn()
const mockDeleteRow = vi.fn()
vi.mock('@/lib/db/media', () => ({
  insertMediaRow: (...args: unknown[]) => mockInsert(...args),
  deleteMediaRow: (...args: unknown[]) => mockDeleteRow(...args),
}))

const { POST } = await import('@/app/(frontend)/api/media-upload/route')
const { ROUTE_BODY_MAX_BYTES } = await import('@/lib/constants/route-body')
const { CACHE_TAGS, EXPIRE_NOW } = await import('@/lib/cache/tags')

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0]

function jpeg(name = 'paragon.jpg', size = 1024) {
  const body = new Uint8Array(size)
  body.set(JPEG_HEAD)
  return new File([body], name, { type: 'image/jpeg' })
}

function request(file: File | null, kind?: string) {
  const body = new FormData()
  if (file) body.append('file', file)
  if (kind !== undefined) body.append('kind', kind)
  return new Request('http://localhost/api/media-upload', { method: 'POST', body })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test'
  mockGetUser.mockResolvedValue({ id: 7, role: 'EMPLOYEE' })
  mockPut.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/paragon.jpg' })
  mockDeleteRow.mockResolvedValue(undefined)
  mockInsert.mockResolvedValue(42)
})

describe('POST /api/media-upload', () => {
  it('stores the file under its row filename and returns the row id', async () => {
    const response = await POST(request(jpeg(), 'faktura'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 42 })

    const [key, , options] = mockPut.mock.calls[0]
    expect(options).toEqual({
      access: 'public',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
      contentType: 'image/jpeg',
      token: 'vercel_blob_rw_test',
    })
    expect(mockInsert).toHaveBeenCalledWith(expect.anything(), {
      filename: key,
      mimeType: 'image/jpeg',
      filesize: 1024,
      kind: 'faktura',
      createdById: 7,
    })
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.media, EXPIRE_NOW)
  })

  it('stores the sniffed type, not the one the browser declared', async () => {
    const pdf = new File(['%PDF-1.7\n'], 'skan.jpg', { type: 'image/jpeg' })

    await POST(request(pdf))

    expect(mockPut.mock.calls[0][2].contentType).toBe('application/pdf')
    expect(mockInsert.mock.calls[0][1]).toMatchObject({ mimeType: 'application/pdf', kind: null })
  })

  it('refuses an anonymous request', async () => {
    mockGetUser.mockResolvedValue(null)

    expect((await POST(request(jpeg()))).status).toBe(401)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('refuses a missing or empty file and an unknown kind', async () => {
    expect((await POST(request(null))).status).toBe(400)
    expect((await POST(request(new File([], 'p.jpg', { type: 'image/jpeg' })))).status).toBe(400)
    expect((await POST(request(jpeg(), 'faktura; DROP'))).status).toBe(400)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('takes a file of exactly the threshold and refuses one byte more', async () => {
    expect((await POST(request(jpeg('a.jpg', ROUTE_BODY_MAX_BYTES)))).status).toBe(200)
    expect((await POST(request(jpeg('b.jpg', ROUTE_BODY_MAX_BYTES + 1)))).status).toBe(413)
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it('refuses HTML named as a photo', async () => {
    const html = new File(['<html><script>x</script>'], 'paragon.jpg', { type: 'image/jpeg' })

    expect((await POST(request(html))).status).toBe(415)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('stores no bytes when the row insert fails, a taken filename included', async () => {
    mockInsert.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }))

    expect((await POST(request(jpeg()))).status).toBe(500)
    expect(mockPut).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('removes the row when the Blob put fails', async () => {
    mockPut.mockRejectedValue(new Error('blob down'))

    expect((await POST(request(jpeg()))).status).toBe(500)
    expect(mockDeleteRow).toHaveBeenCalledWith(expect.anything(), 42)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
