import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { getClientKosztorysByToken } from '@/lib/queries/client-kosztorys'

// The token lookup is the whole access control for the public route, so it is exercised against the
// REAL DB rather than a mocked find — a `where` clause that silently matches everything would pass
// any stub. Asserts the persisted-row outcome: a token that exists resolves, one that doesn't is null.
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  // The cached view wrapper is identity here: unstable_cache needs a request scope node lacks.
  unstable_cache: (fn: unknown) => fn,
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getClientKosztorysByToken (DB)', () => {
  let payload: Payload
  let investmentId: number
  const token = 'test-token-ex532-share'

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const investment = await payload.create({
      collection: 'investments',
      data: { name: 'EX-532 share token spec', status: 'active' },
    })
    investmentId = investment.id
    await payload.create({
      collection: 'kosztorys-shares',
      data: { investment: investmentId, token },
    })
  })

  afterAll(async () => {
    if (investmentId) await payload.delete({ collection: 'investments', id: investmentId })
  })

  it('resolves a live token to that investment’s client view', async () => {
    const view = await getClientKosztorysByToken(token)
    expect(view).not.toBeNull()
    expect(view!.investmentName).toBe('EX-532 share token spec')
  })

  it('returns null for an unknown token — revoked and never-existed are indistinguishable', async () => {
    expect(await getClientKosztorysByToken('no-such-token-ex532')).toBeNull()
  })

  it('returns null for an empty token rather than matching the first share', async () => {
    expect(await getClientKosztorysByToken('')).toBeNull()
  })
})
