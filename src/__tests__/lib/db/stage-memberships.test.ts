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

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('listWorkerStageInvestments (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workerId: number
  let coworkerId: number
  const investmentIds: Record<string, number> = {}

  const createSite = async (
    key: string,
    status: InvestmentStatusT,
    stages: { worker: number; completed?: boolean }[] = [{ worker: workerId }],
  ) => {
    const id = await createTestInvestment(payload, `EX-985 list ${key}`)
    investmentIds[key] = id
    await createKosztorysTree(payload, id, {
      sections: [{ name: 'Sekcja A', items: [{ description: 'Malowanie', plannedQty: 1 }] }],
      stages,
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
    const coworker = await payload.create({
      collection: 'users',
      data: {
        name: 'Nikola Drugi',
        role: 'EMPLOYEE',
        email: 'stage-list-coworker@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    coworkerId = Number(coworker.id)

    await createSite('active', 'active', [{ worker: workerId }, { worker: workerId }])
    await createSite('planowana', 'planowana')
    await createSite('quote', 'quote')
    await createSite('completed', 'completed')
    await createSite('szablon', 'szablon')
    await trashDaysAgo(db, await createSite('trashed', 'active'), 1)
    await createSite('all-closed', 'active', [
      { worker: workerId, completed: true },
      { worker: workerId, completed: true },
    ])
    await createSite('one-open', 'active', [
      { worker: workerId, completed: true },
      { worker: workerId },
    ])
    await createSite('coworker-closed', 'active', [
      { worker: workerId },
      { worker: coworkerId, completed: true },
    ])
  })

  afterAll(async () => {
    for (const id of Object.values(investmentIds)) await deleteTestInvestment(payload, id)
    await purgeFixtureUsers(db)
  })

  it('lists only his aktywne inwestycje with an open etap, one row each, with his link', async () => {
    const rows = await listWorkerStageInvestments(db, workerId)

    expect(rows.map((row) => row.investmentId).sort((a, b) => a - b)).toEqual(
      [investmentIds.active, investmentIds['one-open'], investmentIds['coworker-closed']].sort(
        (a, b) => a - b,
      ),
    )
    for (const row of rows) expect(row.token).toEqual(expect.any(String))
  })

  it("drops a site for the coworker whose only etap there is zakończony, not for him", async () => {
    const coworkerSites = await listWorkerStageInvestments(db, coworkerId)

    expect(coworkerSites.map((row) => row.investmentId)).not.toContain(
      investmentIds['coworker-closed'],
    )
  })
})
