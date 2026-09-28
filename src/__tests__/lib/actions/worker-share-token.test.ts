import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/constants'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// A worker token is the only credential on an unauthenticated page that prints that worker's stawka,
// so its lifecycle runs against the REAL DB and asserts PERSISTED rows — a returned token proves
// nothing if the write didn't land, and a rotation that left the old row alive would keep a second
// door open.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const authState = vi.hoisted(() => ({ role: 'OWNER' as string }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async (roles: readonly string[]) =>
    roles.includes(authState.role)
      ? { success: true, user: { id: 0, email: 'o@t.com', name: 'Owner', role: authState.role } }
      : { success: false, error: 'Brak uprawnień' },
  ),
}))

const { generateWorkerShareLinkAction, getWorkerShareLinkAction, revokeWorkerShareLinkAction } =
  await import('@/lib/actions/kosztorys-worker-share')
const { getWorkerKosztorysByToken } = await import('@/lib/queries/worker-kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys worker share token lifecycle (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let readyWorkerId: number
  let mixedWorkerId: number
  let unconfirmedWorkerId: number

  const createWorker = async (name: string, email: string) => {
    const created = await payload.create({
      collection: 'users',
      data: { name, role: 'EMPLOYEE', email, password: 'test-password-123' },
      context: { skipRevalidation: true },
    })
    return Number(created.id)
  }

  const persistedTokens = async (workerId: number) => {
    const shares = await payload.find({
      collection: 'kosztorys-worker-shares',
      where: { investment: { equals: investmentId }, worker: { equals: workerId } },
      depth: 0,
      overrideAccess: true,
    })
    return shares.docs.map((share) => share.token)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-875 worker share lifecycle spec')
    readyWorkerId = await createWorker('Jan Gotowy', 'worker-share-ready@test.local')
    mixedWorkerId = await createWorker('Jan Mieszany', 'worker-share-mixed@test.local')
    unconfirmedWorkerId = await createWorker('Jan Niepotwierdzony', 'worker-share-null@test.local')

    await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Sekcja A', items: [{ description: 'Malowanie', plannedQty: 10 }] }],
      stages: [
        { worker: readyWorkerId, plane: 'w_tools' },
        { worker: mixedWorkerId, plane: 'w_tools' },
        { worker: mixedWorkerId, plane: 'own_tools' },
        { worker: unconfirmedWorkerId, plane: null },
      ],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('generates a token and persists exactly one row for the pair', async () => {
    const res = await generateWorkerShareLinkAction({ investmentId, workerId: readyWorkerId })
    expect(res.success).toBe(true)

    const tokens = await persistedTokens(readyWorkerId)
    expect(tokens).toEqual([res.success ? res.data : ''])
    expect(await getWorkerKosztorysByToken(tokens[0])).not.toBeNull()
  })

  it('rotating replaces the token in place — the old one stops resolving', async () => {
    const [oldToken] = await persistedTokens(readyWorkerId)

    const rotated = await generateWorkerShareLinkAction({ investmentId, workerId: readyWorkerId })
    const newToken = rotated.success ? rotated.data : ''
    expect(newToken).not.toBe(oldToken)
    expect(await persistedTokens(readyWorkerId)).toEqual([newToken])
    expect(await getWorkerKosztorysByToken(oldToken)).toBeNull()
    expect(await getWorkerKosztorysByToken(newToken)).not.toBeNull()
  })

  it('lets a MANAGER rotate the link, like the investor link', async () => {
    const [before] = await persistedTokens(readyWorkerId)
    authState.role = 'MANAGER'
    const res = await generateWorkerShareLinkAction({ investmentId, workerId: readyWorkerId })
    authState.role = 'OWNER'

    expect(res.success).toBe(true)
    const [after] = await persistedTokens(readyWorkerId)
    expect(after).not.toBe(before)
    expect(await getWorkerKosztorysByToken(after)).not.toBeNull()
  })

  it('rejects an EMPLOYEE without touching the row', async () => {
    const before = await persistedTokens(readyWorkerId)
    authState.role = 'EMPLOYEE'
    const res = await generateWorkerShareLinkAction({ investmentId, workerId: readyWorkerId })
    authState.role = 'OWNER'

    expect(res.success).toBe(false)
    expect(await persistedTokens(readyWorkerId)).toEqual(before)
  })

  it('refuses a second row for the same investment and worker at the DB', async () => {
    await expect(
      payload.create({
        collection: 'kosztorys-worker-shares',
        data: {
          investment: investmentId,
          worker: readyWorkerId,
          token: `test-token-ex875-dup-${process.pid}-${Date.now()}`,
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    expect(await persistedTokens(readyWorkerId)).toHaveLength(1)
  })

  it('refuses to mint for a worker whose etapy mix rozliczenia', async () => {
    const res = await generateWorkerShareLinkAction({ investmentId, workerId: mixedWorkerId })
    expect(res).toMatchObject({
      success: false,
      error: WORKER_SCOPE_BLOCK_MESSAGES['mixed-planes'],
    })
    expect(await persistedTokens(mixedWorkerId)).toEqual([])
  })

  it('refuses to mint for a worker whose etap has no rozliczenie', async () => {
    const res = await generateWorkerShareLinkAction({ investmentId, workerId: unconfirmedWorkerId })
    expect(res).toMatchObject({
      success: false,
      error: WORKER_SCOPE_BLOCK_MESSAGES['unconfirmed-plane'],
    })
    expect(await persistedTokens(unconfirmedWorkerId)).toEqual([])
  })

  it('revoking deletes the row and the token stops resolving', async () => {
    const [token] = await persistedTokens(readyWorkerId)

    const res = await revokeWorkerShareLinkAction({ investmentId, workerId: readyWorkerId })
    expect(res.success).toBe(true)
    expect(await persistedTokens(readyWorkerId)).toEqual([])
    expect(await getWorkerKosztorysByToken(token)).toBeNull()

    const current = await getWorkerShareLinkAction({ investmentId, workerId: readyWorkerId })
    expect(current).toMatchObject({ success: true, data: null })
  })
})
