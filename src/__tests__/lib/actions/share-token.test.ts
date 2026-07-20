import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// The share token is the only credential guarding an unauthenticated page, so its lifecycle runs
// against the REAL DB and asserts PERSISTED state (does a row with this token exist?) — a returned
// token proves nothing if the write didn't land, and a rotation that leaves the old row alive would
// keep a second door open.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const authState = vi.hoisted(() => ({ role: 'OWNER' as string, userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: authState.role },
  })),
}))

const { generateShareLinkAction, getShareLinkAction, revokeShareLinkAction } =
  await import('@/lib/actions/kosztorys-share')
const { getClientKosztorysByToken } = await import('@/lib/queries/client-kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys share token lifecycle (DB)', () => {
  let payload: Payload
  let investmentId: number

  const countShares = async () => {
    const shares = await payload.find({
      collection: 'kosztorys-shares',
      where: { investment: { equals: investmentId } },
      depth: 0,
    })
    return shares.totalDocs
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const investment = await payload.create({
      collection: 'investments',
      data: { name: 'EX-532 share lifecycle spec', status: 'active' },
    })
    investmentId = investment.id
  })

  afterAll(async () => {
    authState.role = 'OWNER'
    if (investmentId) await payload.delete({ collection: 'investments', id: investmentId })
  })

  it('generates a token and persists exactly one share row', async () => {
    const res = await generateShareLinkAction(investmentId)
    expect(res.success).toBe(true)
    expect(await countShares()).toBe(1)

    const token = res.success ? res.data : ''
    expect(await getClientKosztorysByToken(token)).not.toBeNull()
  })

  it('rotating replaces the token in place — the old one stops resolving', async () => {
    const first = await getShareLinkAction(investmentId)
    const oldToken = first.success ? first.data : null
    expect(oldToken).toBeTruthy()

    const rotated = await generateShareLinkAction(investmentId)
    const newToken = rotated.success ? rotated.data : ''
    expect(newToken).not.toBe(oldToken)
    expect(await countShares()).toBe(1)
    expect(await getClientKosztorysByToken(oldToken!)).toBeNull()
    expect(await getClientKosztorysByToken(newToken)).not.toBeNull()
  })

  it('rejects a MANAGER without touching the row', async () => {
    const before = await getShareLinkAction(investmentId)
    authState.role = 'MANAGER'

    const res = await generateShareLinkAction(investmentId)
    expect(res.success).toBe(false)

    authState.role = 'OWNER'
    const after = await getShareLinkAction(investmentId)
    expect(after.success && after.data).toBe(before.success && before.data)
  })

  it('revoking deletes the row and the token stops resolving', async () => {
    const current = await getShareLinkAction(investmentId)
    const token = current.success ? current.data : null

    expect((await revokeShareLinkAction(investmentId)).success).toBe(true)
    expect(await countShares()).toBe(0)
    expect(await getClientKosztorysByToken(token!)).toBeNull()
  })
})
