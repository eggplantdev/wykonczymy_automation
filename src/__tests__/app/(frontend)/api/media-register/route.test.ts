import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateTag } from '@/__tests__/stubs/next-cache'

vi.mock('server-only', () => ({}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({})) }))

const mockGetUser = vi.fn()
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: () => mockGetUser(),
}))

const { mockHead, mockDel, BlobNotFoundError } = vi.hoisted(() => ({
  mockHead: vi.fn(),
  mockDel: vi.fn(),
  BlobNotFoundError: class BlobNotFoundError extends Error {},
}))
vi.mock('@vercel/blob', () => ({ head: mockHead, del: mockDel, BlobNotFoundError }))

const mockInsert = vi.fn()
const mockIsReferenced = vi.fn()
vi.mock('@/lib/db/media', () => ({
  insertMediaRow: (...args: unknown[]) => mockInsert(...args),
  isMediaFilenameReferenced: (...args: unknown[]) => mockIsReferenced(...args),
}))

const { POST } = await import('@/app/(frontend)/api/media-register/route')
const { CACHE_TAGS, EXPIRE_NOW } = await import('@/lib/cache/tags')

const FILENAME = 'faktura-a1b2c3.pdf'
const BLOB_URL = `https://store1.public.blob.vercel-storage.com/${FILENAME}`
const PDF_HEAD = new TextEncoder().encode('%PDF-1.7\n')
const HTML_HEAD = new TextEncoder().encode('<html><script>x</script>')

const fetchMock = vi.fn()

function request(body: unknown) {
  return new Request('http://localhost/api/media-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_store1_secret'
  vi.stubGlobal('fetch', fetchMock)
  mockGetUser.mockResolvedValue({ id: 7, role: 'EMPLOYEE' })
  mockHead.mockResolvedValue({ size: 6_000_000, uploadedAt: minutesAgo(1) })
  fetchMock.mockResolvedValue(new Response(PDF_HEAD, { status: 206 }))
  mockInsert.mockResolvedValue(42)
  mockIsReferenced.mockResolvedValue(false)
  mockDel.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

describe('POST /api/media-register', () => {
  it('registers the blob with the sniffed type, its stored size, the kind and the caller', async () => {
    const response = await POST(request({ filename: FILENAME, kind: 'projekt' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 42 })
    expect(mockHead).toHaveBeenCalledWith(BLOB_URL, { token: 'vercel_blob_rw_store1_secret' })
    expect(fetchMock).toHaveBeenCalledWith(BLOB_URL, { headers: { Range: 'bytes=0-1023' } })
    expect(mockInsert).toHaveBeenCalledWith(expect.anything(), {
      filename: FILENAME,
      mimeType: 'application/pdf',
      filesize: 6_000_000,
      kind: 'projekt',
      createdById: 7,
    })
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.media, EXPIRE_NOW)
  })

  it('refuses an anonymous request', async () => {
    mockGetUser.mockResolvedValue(null)

    expect((await POST(request({ filename: FILENAME }))).status).toBe(401)
    expect(mockHead).not.toHaveBeenCalled()
  })

  it('refuses a filename that is a path, a missing one and an unknown kind', async () => {
    expect((await POST(request({ filename: 'inny/klucz.pdf' }))).status).toBe(400)
    expect((await POST(request({}))).status).toBe(400)
    expect((await POST(request({ filename: FILENAME, kind: 'faktura; DROP' }))).status).toBe(400)
    expect(mockHead).not.toHaveBeenCalled()
  })

  it('refuses a blob that is not in the store', async () => {
    mockHead.mockRejectedValue(new BlobNotFoundError())

    expect((await POST(request({ filename: FILENAME }))).status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // An old key is someone's stored faktura, not this caller's upload — never read, never deleted.
  it('refuses a stale blob without touching it', async () => {
    mockHead.mockResolvedValue({ size: 6_000_000, uploadedAt: minutesAgo(61) })

    expect((await POST(request({ filename: FILENAME }))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('deletes a refused type that no row holds', async () => {
    fetchMock.mockResolvedValue(new Response(HTML_HEAD, { status: 206 }))

    const response = await POST(request({ filename: FILENAME }))

    expect(response.status).toBe(415)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockIsReferenced).toHaveBeenCalledWith(expect.anything(), FILENAME)
    expect(mockDel).toHaveBeenCalledWith(BLOB_URL, { token: 'vercel_blob_rw_store1_secret' })
  })

  it('keeps a refused type whose filename a row holds', async () => {
    fetchMock.mockResolvedValue(new Response(HTML_HEAD, { status: 206 }))
    mockIsReferenced.mockResolvedValue(true)

    expect((await POST(request({ filename: FILENAME }))).status).toBe(415)
    expect(mockDel).not.toHaveBeenCalled()
  })

  // A taken filename means the blob already belongs to a row.
  it('answers a second registration of the same blob with 409 and keeps the blob', async () => {
    mockInsert.mockRejectedValue(
      new Error('insert failed', { cause: Object.assign(new Error('dup'), { code: '23505' }) }),
    )

    expect((await POST(request({ filename: FILENAME }))).status).toBe(409)
    expect(mockDel).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('deletes the unreferenced blob when the insert fails for another reason', async () => {
    mockInsert.mockRejectedValue(new Error('connection reset'))

    expect((await POST(request({ filename: FILENAME }))).status).toBe(500)
    expect(mockDel).toHaveBeenCalledWith(BLOB_URL, { token: 'vercel_blob_rw_store1_secret' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
