import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The share token is the only credential guarding an unauthenticated page, so its lifecycle runs
// against the REAL DB and asserts PERSISTED state (does a row with this token exist?) — a returned
// token proves nothing if the write didn't land, and a rotation that leaves the old row alive would
// keep a second door open.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const authState = vi.hoisted(() => ({ role: 'OWNER' as string, userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async (roles: readonly string[]) =>
    roles.includes(authState.role)
      ? {
          success: true,
          user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: authState.role },
        }
      : { success: false, error: 'Brak uprawnień' },
  ),
}))

const { ensureShareLinkAction, generateShareLinkAction, revokeShareLinkAction } =
  await import('@/lib/actions/kosztorys-share')
const { getPreviewKosztorysByToken } = await import('@/lib/queries/preview-kosztorys')

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

  const persistedToken = async () => {
    const shares = await payload.find({
      collection: 'kosztorys-shares',
      where: { investment: { equals: investmentId } },
      depth: 0,
    })
    return shares.docs[0]?.token ?? null
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentId = await createTestInvestment(payload, 'EX-532 share lifecycle spec')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('„Udostępnij" creates the first link and persists exactly one share row', async () => {
    const res = await ensureShareLinkAction(investmentId)
    expect(res.success).toBe(true)
    expect(await countShares()).toBe(1)

    const token = res.success ? res.data : ''
    expect(await persistedToken()).toBe(token)
    expect(await getPreviewKosztorysByToken(token)).not.toBeNull()
  })

  // A rotation here would cut off the investor who holds the link — and two overlapping clicks
  // would kill the one the first click copied.
  it('„Udostępnij" over a live link hands it back untouched', async () => {
    const before = await persistedToken()

    const [first, second] = await Promise.all([
      ensureShareLinkAction(investmentId),
      ensureShareLinkAction(investmentId),
    ])

    expect(first).toEqual({ success: true, data: before })
    expect(second).toEqual({ success: true, data: before })
    expect(await persistedToken()).toBe(before)
    expect(await countShares()).toBe(1)
  })

  it('rotating replaces the token in place — the old one stops resolving', async () => {
    const oldToken = await persistedToken()
    expect(oldToken).toBeTruthy()

    const rotated = await generateShareLinkAction(investmentId)
    const newToken = rotated.success ? rotated.data : ''
    expect(newToken).not.toBe(oldToken)
    expect(await countShares()).toBe(1)
    expect(await getPreviewKosztorysByToken(oldToken!)).toBeNull()
    expect(await getPreviewKosztorysByToken(newToken)).not.toBeNull()
  })

  it('lets a MANAGER rotate the link — the persisted token is the one that resolves', async () => {
    const before = await persistedToken()
    authState.role = 'MANAGER'

    const res = await generateShareLinkAction(investmentId)
    authState.role = 'OWNER'
    expect(res.success).toBe(true)

    const token = await persistedToken()
    expect(token).not.toBe(before)
    expect(await getPreviewKosztorysByToken(token!)).not.toBeNull()
  })

  it('rejects an EMPLOYEE without touching the row', async () => {
    const before = await persistedToken()
    authState.role = 'EMPLOYEE'

    const res = await generateShareLinkAction(investmentId)
    authState.role = 'OWNER'
    expect(res.success).toBe(false)

    expect(await persistedToken()).toBe(before)
  })

  it('revoking deletes the row and the token stops resolving', async () => {
    const token = await persistedToken()

    expect((await revokeShareLinkAction(investmentId)).success).toBe(true)
    expect(await countShares()).toBe(0)
    expect(await getPreviewKosztorysByToken(token!)).toBeNull()
  })
})
