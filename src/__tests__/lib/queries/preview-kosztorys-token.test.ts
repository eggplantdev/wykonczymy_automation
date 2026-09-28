import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getPreviewKosztorysByToken } from '@/lib/queries/preview-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The token lookup is the whole access control for the public route, so it is exercised against the
// REAL DB rather than a mocked find — a `where` clause that silently matches everything would pass
// any stub. Asserts the persisted-row outcome: a token that exists resolves, one that doesn't is null.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getPreviewKosztorysByToken (DB)', () => {
  let payload: Payload
  let investmentId: number
  // Per-run suffix: `token` is globally unique, so a crash between beforeAll and afterAll would
  // leave a row that wedges every later run of this spec until someone deletes it by hand.
  const token = `test-token-ex532-share-${process.pid}-${Date.now()}`

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentId = await createTestInvestment(payload, 'EX-532 share token spec')
    await payload.create({
      collection: 'kosztorys-shares',
      data: { investment: investmentId, token },
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('resolves a live token to that investment’s client view', async () => {
    const view = await getPreviewKosztorysByToken(token)
    expect(view).not.toBeNull()
    expect(view!.investmentName).toBe('EX-532 share token spec')
  })

  it('returns null for an unknown token — revoked and never-existed are indistinguishable', async () => {
    expect(await getPreviewKosztorysByToken('no-such-token-ex532')).toBeNull()
  })

  it('returns null for an empty token rather than matching the first share', async () => {
    expect(await getPreviewKosztorysByToken('')).toBeNull()
  })

  it('returns null while the investment is in the trash, and the same token works after restore', async () => {
    await payload.update({
      collection: 'investments',
      id: investmentId,
      data: { trashedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    try {
      expect(await getPreviewKosztorysByToken(token)).toBeNull()
    } finally {
      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { trashedAt: null },
        overrideAccess: true,
      })
    }
    expect(await getPreviewKosztorysByToken(token)).not.toBeNull()
  })
})
