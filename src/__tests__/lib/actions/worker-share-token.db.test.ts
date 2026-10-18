import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser } from '@/__tests__/helpers/user'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { generateWorkerLinkAction } = await import('@/lib/actions/kosztorys-worker-share')
const { getWorkerReportPage } = await import('@/lib/queries/worker-report-page')

describe.skipIf(!ENV_READY)('kosztorys worker share token lifecycle (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let readyWorkerId: number
  let mixedWorkerId: number
  let unconfirmedWorkerId: number

  const persistedTokens = async (workerId: number) => {
    const shares = await payload.find({
      collection: 'worker-report-shares',
      where: { investment: { equals: investmentId }, worker: { equals: workerId } },
      depth: 0,
      overrideAccess: true,
    })
    return shares.docs.map((share) => share.token)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-966 worker share lifecycle spec')
    readyWorkerId = await createTestUser(payload, {
      name: 'Jan Gotowy',
      email: 'worker-share-ready@test.local',
    })
    mixedWorkerId = await createTestUser(payload, {
      name: 'Jan Mieszany',
      email: 'worker-share-mixed@test.local',
    })
    unconfirmedWorkerId = await createTestUser(payload, {
      name: 'Jan Niepotwierdzony',
      email: 'worker-share-null@test.local',
    })

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
    const res = await generateWorkerLinkAction({ investmentId, workerId: readyWorkerId })
    expect(res.success).toBe(true)

    const tokens = await persistedTokens(readyWorkerId)
    expect(tokens).toEqual([res.success ? res.data : ''])
    expect(await getWorkerReportPage(tokens[0])).not.toBeNull()
  })

  it('rotating replaces the token in place — the old one stops resolving', async () => {
    const [oldToken] = await persistedTokens(readyWorkerId)

    const rotated = await generateWorkerLinkAction({ investmentId, workerId: readyWorkerId })
    const newToken = rotated.success ? rotated.data : ''
    expect(newToken).not.toBe(oldToken)
    expect(await persistedTokens(readyWorkerId)).toEqual([newToken])
    expect(await getWorkerReportPage(oldToken)).toBeNull()
    expect(await getWorkerReportPage(newToken)).not.toBeNull()
  })

  it('lets a MANAGER rotate the link, like the investor link', async () => {
    const [before] = await persistedTokens(readyWorkerId)
    authState.role = 'MANAGER'
    const res = await generateWorkerLinkAction({ investmentId, workerId: readyWorkerId })
    authState.role = 'OWNER'

    expect(res.success).toBe(true)
    const [after] = await persistedTokens(readyWorkerId)
    expect(after).not.toBe(before)
    expect(await getWorkerReportPage(after)).not.toBeNull()
  })

  it('rejects an EMPLOYEE without touching the row', async () => {
    const before = await persistedTokens(readyWorkerId)
    authState.role = 'EMPLOYEE'
    const res = await generateWorkerLinkAction({ investmentId, workerId: readyWorkerId })
    authState.role = 'OWNER'

    expect(res.success).toBe(false)
    expect(await persistedTokens(readyWorkerId)).toEqual(before)
  })

  it('refuses a second row for the same investment and worker at the DB', async () => {
    await expect(
      payload.create({
        collection: 'worker-report-shares',
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

  it.each([
    ['mix rozliczenia', () => mixedWorkerId],
    ['has no rozliczenie', () => unconfirmedWorkerId],
  ])('mints for a worker whose etapy %s', async (_case, workerId) => {
    const res = await generateWorkerLinkAction({ investmentId, workerId: workerId() })

    expect(res.success).toBe(true)
    expect(await persistedTokens(workerId())).toEqual([res.success ? res.data : ''])
  })
})
