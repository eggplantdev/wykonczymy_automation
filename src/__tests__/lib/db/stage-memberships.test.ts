import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import {
  createTestInvestment,
  deleteTestInvestment,
  trashDaysAgo,
} from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The worker's own page lists the sites he can report on — a zakończona, trashed or szablon
// inwestycja must not offer him a link the send would refuse.
vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('listWorkerStageInvestments (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workerId: number
  const investmentIds: Record<string, number> = {}

  const createSite = async (key: string, status: InvestmentStatusT, stageCount = 1) => {
    const id = await createTestInvestment(payload, `EX-985 list ${key}`)
    investmentIds[key] = id
    await createKosztorysTree(payload, id, {
      sections: [{ name: 'Sekcja A', items: [{ description: 'Malowanie', plannedQty: 1 }] }],
      stages: Array.from({ length: stageCount }, () => ({ worker: workerId })),
    })
    // Raw SQL: the szablon status is guarded against any Payload write.
    await db.execute(sql`UPDATE investments SET status = ${status} WHERE id = ${id}`)
    return id
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const worker = await payload.create({
      collection: 'users',
      data: {
        name: 'Nikola Listowy',
        role: 'EMPLOYEE',
        email: 'stage-list@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerId = Number(worker.id)

    await createSite('active', 'active', 2)
    await createSite('planowana', 'planowana')
    await createSite('quote', 'quote')
    await createSite('completed', 'completed')
    await createSite('szablon', 'szablon')
    await trashDaysAgo(db, await createSite('trashed', 'active'), 1)
  })

  afterAll(async () => {
    for (const id of Object.values(investmentIds)) await deleteTestInvestment(payload, id)
    await purgeFixtureUsers(db)
  })

  it('lists only the sites he can still report on, one row each, with his link', async () => {
    const rows = await listWorkerStageInvestments(db, workerId)

    expect(rows.map((row) => row.investmentId).sort()).toEqual(
      [investmentIds.active, investmentIds.planowana, investmentIds.quote].sort(),
    )
    for (const row of rows) expect(row.token).toEqual(expect.any(String))
  })
})
