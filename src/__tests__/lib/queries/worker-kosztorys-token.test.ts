import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { getPreviewKosztorysByToken } from '@/lib/queries/preview-kosztorys'
import { getWorkerKosztorysByToken } from '@/lib/queries/worker-kosztorys'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The token lookup is the whole access control for /p/<token>, and the narrowing to one worker's
// etapy is the whole privacy boundary between two crews on one site — both run against the REAL DB,
// because a `where` that matched everything or a filter on the wrong id would pass any stub.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getWorkerKosztorysByToken (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let otherWorkerId: number
  let stageIds: number[]
  let itemIds: number[]
  // Per-run suffix: `token` is globally unique, so a crash mid-run would otherwise wedge later runs.
  const suffix = `${process.pid}-${Date.now()}`
  const workerToken = `test-token-ex875-worker-${suffix}`
  const investorToken = `test-token-ex875-investor-${suffix}`

  const createWorker = async (name: string, email: string) => {
    const created = await payload.create({
      collection: 'users',
      data: { name, role: 'EMPLOYEE', email, password: 'test-password-123' },
      context: { skipRevalidation: true },
    })
    return Number(created.id)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-875 worker token spec')
    workerId = await createWorker('Jan Kowalski', 'worker-token-own@test.local')
    otherWorkerId = await createWorker('Piotr Nowak', 'worker-token-other@test.local')
    ;({ stageIds, itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [
            { description: 'Malowanie', plannedQty: 10, clientPrice: 100 },
            { description: 'Gruntowanie', plannedQty: 5, clientPrice: 40 },
          ],
        },
      ],
      stages: [
        { worker: workerId, plane: 'w_tools' },
        { worker: otherWorkerId, plane: 'w_tools' },
        { worker: workerId, plane: 'w_tools' },
      ],
      progress: [
        { item: 0, stage: 0, qtyDone: 2 },
        { item: 0, stage: 1, qtyDone: 3 },
        { item: 1, stage: 2, qtyDone: 1 },
      ],
    }))

    await payload.create({
      collection: 'kosztorys-worker-shares',
      data: { investment: investmentId, worker: workerId, token: workerToken },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'kosztorys-shares',
      data: { investment: investmentId, token: investorToken },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('resolves a live token to that worker’s projection', async () => {
    const view = await getWorkerKosztorysByToken(workerToken)
    expect(view).toMatchObject({
      kind: 'ready',
      investmentName: 'EX-875 worker token spec',
      worker: { workerId, name: 'Jan Kowalski', plane: 'w_tools' },
    })
  })

  it('carries only the worker’s etapy and their progress — never another crew’s', async () => {
    const view = await getWorkerKosztorysByToken(workerToken)
    if (view?.kind !== 'ready') throw new Error('expected a ready projection')

    expect(view.tree.stages.map((stage) => stage.id)).toEqual([stageIds[0], stageIds[2]])
    expect(view.tree.progress.map((progress) => progress.stageId)).not.toContain(stageIds[1])
    expect(view.tree.progress).toHaveLength(2)
  })

  it('still counts the other crew’s execution toward „Pozostało"', async () => {
    const view = await getWorkerKosztorysByToken(workerToken)
    if (view?.kind !== 'ready') throw new Error('expected a ready projection')

    expect(view.worker.executedQtyByItem).toEqual({ [itemIds[0]]: 5, [itemIds[1]]: 1 })
  })

  it('returns null for an unknown or empty token', async () => {
    expect(await getWorkerKosztorysByToken('no-such-token-ex875')).toBeNull()
    expect(await getWorkerKosztorysByToken('')).toBeNull()
  })

  it('keeps the two token spaces apart — neither route resolves the other’s token', async () => {
    expect(await getWorkerKosztorysByToken(investorToken)).toBeNull()
    expect(await getPreviewKosztorysByToken(workerToken)).toBeNull()
  })

  it('returns null while the investment is in the trash', async () => {
    await payload.update({
      collection: 'investments',
      id: investmentId,
      data: { trashedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    try {
      expect(await getWorkerKosztorysByToken(workerToken)).toBeNull()
    } finally {
      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { trashedAt: null },
        overrideAccess: true,
      })
    }
  })

  it('returns null once the row is revoked', async () => {
    await payload.delete({
      collection: 'kosztorys-worker-shares',
      where: { token: { equals: workerToken } },
      overrideAccess: true,
    })
    expect(await getWorkerKosztorysByToken(workerToken)).toBeNull()
  })
})
