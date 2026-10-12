import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'
import { pl } from '@/lib/i18n/dictionaries/pl'

// The DB spec owns the WHERE; this one owns what wraps it — the reason gate runs before any write,
// a zero-row decision reads as „already decided", and only a landed one expires the transfers.
vi.mock('server-only', () => ({}))
const { getCurrentUserJwt } = vi.hoisted(() => ({ getCurrentUserJwt: vi.fn() }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({ getCurrentUserJwt }))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({})),
}))
const execute = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({ execute })) }))

const { acceptPayoutAction, rejectPayoutAction } = await import('@/lib/actions/payout-confirmation')

const WORKER_ID = 7

describe('payout confirmation actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserJwt.mockResolvedValue({
      id: WORKER_ID,
      email: 'w@t.com',
      name: 'W',
      role: 'EMPLOYEE',
    })
  })

  it('refuses a reason under the minimum before any write', async () => {
    const result = await rejectPayoutAction(1, { reason: '  ab ' })

    expect(result).toMatchObject({ success: false, messageKey: 'payoutReasonTooShort' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('reads a decision that matched no row as already decided, and expires nothing', async () => {
    execute.mockResolvedValue({ rows: [] })

    const results = [
      await acceptPayoutAction(1),
      await rejectPayoutAction(1, { reason: 'Brak 100 zł' }),
    ]

    for (const result of results) {
      expect(result).toEqual({
        success: false,
        error: pl.notices.payoutAlreadyDecided,
        messageKey: 'payoutAlreadyDecided',
      })
    }
    expect(revalidateCollections).not.toHaveBeenCalled()
  })

  it('expires the transfers once a decision lands', async () => {
    execute.mockResolvedValue({ rows: [{ id: 1 }] })

    expect(await acceptPayoutAction(1)).toEqual({ success: true })
    expect(revalidateCollections).toHaveBeenCalledWith(['transfers'], undefined)
  })
})
