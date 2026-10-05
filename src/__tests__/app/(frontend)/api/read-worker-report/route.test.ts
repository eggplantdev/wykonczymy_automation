import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({})) }))

const mockGetUser = vi.fn()
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: () => mockGetUser(),
}))

const mockReadTarget = vi.fn()
vi.mock('@/lib/db/worker-report-share', () => ({
  readReportTarget: (...args: unknown[]) => mockReadTarget(...args),
}))

vi.mock('@/lib/queries/kosztorys', () => ({
  buildKosztorysTree: async () => ({
    sections: [{ name: 'Łazienka', items: [{ id: 1, unit: 'm2', description: 'Płytki' }] }],
  }),
}))

const mockReadPage = vi.fn()
vi.mock('@/lib/ai/worker-report-scan', () => ({
  readWorkerReportPage: (...args: unknown[]) => mockReadPage(...args),
}))

const { POST } = await import('@/app/(frontend)/api/read-worker-report/route')

const SCANNED = { rows: [{ ref: '1-0', qty: 2, isUncertain: false }], extras: [] }

function request(file: File = new File(['x'], 'k.jpg', { type: 'image/jpeg' })) {
  const body = new FormData()
  body.append('file', file)
  body.append('investmentId', '6')
  body.append('workerId', '9')
  return new Request('http://localhost/api/read-worker-report', { method: 'POST', body })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ id: 1, role: 'MANAGER' })
  mockReadTarget.mockResolvedValue({ investmentId: 6, workerId: 9, language: 'uk' })
  mockReadPage.mockResolvedValue(SCANNED)
})

describe('POST /api/read-worker-report', () => {
  it('returns the page read from the photo, with units in the worker’s language', async () => {
    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: SCANNED })
    const [, { units }] = mockReadPage.mock.calls[0]
    expect(units).toContainEqual({ value: 'm²', label: 'm² — м²' })
    expect(mockReadTarget).toHaveBeenCalledWith({}, 6, 9)
  })

  it('refuses a worker without a session to management', async () => {
    mockGetUser.mockResolvedValue({ id: 9, role: 'EMPLOYEE' })

    expect((await POST(request())).status).toBe(401)
    expect(mockReadPage).not.toHaveBeenCalled()
  })

  it('refuses a worker who is not on the investment', async () => {
    mockReadTarget.mockResolvedValue(null)

    expect((await POST(request())).status).toBe(400)
    expect(mockReadPage).not.toHaveBeenCalled()
  })

  it('refuses a non-image file', async () => {
    const pdf = new File(['x'], 'k.pdf', { type: 'application/pdf' })

    expect((await POST(request(pdf))).status).toBe(400)
    expect(mockReadPage).not.toHaveBeenCalled()
  })
})
