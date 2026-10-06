import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockGetUser = vi.fn()
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: () => mockGetUser(),
}))

const mockScanReceipt = vi.fn()
vi.mock('@/lib/ai/scan-receipt', () => ({
  scanReceipt: (...args: unknown[]) => mockScanReceipt(...args),
}))

const { POST } = await import('@/app/(frontend)/api/extract-receipt/route')
const { MAX_RECEIPT_PAGES } = await import('@/lib/constants/receipt-scan')

function page(name = 'p.jpg', type = 'image/jpeg', bytes = 'x') {
  return new File([bytes], name, { type })
}

function request(files: File[], otherCategoryNames?: string) {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  if (otherCategoryNames !== undefined) body.append('otherCategoryNames', otherCategoryNames)
  return new Request('http://localhost/api/extract-receipt', { method: 'POST', body })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ id: 1, role: 'MANAGER' })
  mockScanReceipt.mockResolvedValue({ amount: 100 })
})

describe('POST /api/extract-receipt', () => {
  it('scans a multi-page invoice', async () => {
    const response = await POST(request([page('p1.jpg'), page('p2.jpg')], '["Paliwo"]'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { amount: 100 } })
    expect(mockScanReceipt).toHaveBeenCalledWith(expect.arrayContaining([]), ['Paliwo'])
    expect(mockScanReceipt.mock.calls[0][0]).toHaveLength(2)
  })

  it('rejects a non-management role', async () => {
    mockGetUser.mockResolvedValue({ id: 9, role: 'EMPLOYEE' })

    expect((await POST(request([page()]))).status).toBe(401)
    expect(mockScanReceipt).not.toHaveBeenCalled()
  })

  // Each page costs a timeout slice; past the cap the worst case outruns the route's maxDuration
  // and the platform kills the invocation instead of reporting a clean error.
  it('rejects more pages than one scan budget allows', async () => {
    const files = Array.from({ length: MAX_RECEIPT_PAGES + 1 }, (_, i) => page(`p${i}.jpg`))

    const response = await POST(request(files))

    expect(response.status).toBe(400)
    expect(mockScanReceipt).not.toHaveBeenCalled()
  })

  it('rejects a file type the media collection would not accept', async () => {
    const response = await POST(request([page('sheet.xlsx', 'application/vnd.ms-excel')]))

    expect(response.status).toBe(400)
    expect(mockScanReceipt).not.toHaveBeenCalled()
  })

  it('rejects an empty file', async () => {
    const response = await POST(request([page('p.jpg', 'image/jpeg', '')]))

    expect(response.status).toBe(400)
    expect(mockScanReceipt).not.toHaveBeenCalled()
  })

  // A malformed list is a client bug, not a provider failure — it must not land in the 500 branch
  // that owes a Sentry capture.
  it('malformed category JSON is a 400, not a 500', async () => {
    const response = await POST(request([page()], '{not json'))

    expect(response.status).toBe(400)
    expect(mockScanReceipt).not.toHaveBeenCalled()
  })

  it('a JSON list of the wrong shape is a 400', async () => {
    const response = await POST(request([page()], '{"a":1}'))

    expect(response.status).toBe(400)
  })

  it('a provider failure surfaces as a 500', async () => {
    mockScanReceipt.mockRejectedValue(new Error('model down'))

    const response = await POST(request([page()]))

    expect(response.status).toBe(500)
  })
})
