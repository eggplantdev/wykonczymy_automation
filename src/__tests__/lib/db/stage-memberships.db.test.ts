import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { listWorkersWithActiveStages, listWorkerStageInvestments } from '@/lib/db/stage-memberships'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import {
  createTestInvestment,
  deleteTestInvestment,
  trashDaysAgo,
} from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

describe.skipIf(!ENV_READY)('listWorkersWithActiveStages (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const investmentIds: number[] = []
  const workers: Record<string, number> = {}

  async function investmentWithStage(
    status: InvestmentStatusT,
    workerId: number,
    completed = false,
  ) {
    const id = await createTestInvestment(payload, `EX-949 scan workers ${status}`, { status })
    investmentIds.push(id)
    await createKosztorysTree(payload, id, {
      sections: [],
      stages: [{ worker: workerId, completed }],
    })
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    for (const name of ['active', 'inactive', 'completed', 'stage-closed']) {
      workers[name] = await createTestUser(payload, {
        name: `Skan ${name}`,
        email: `scan-list-${name}@test.local`,
      })
    }
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${workers.inactive}`)

    await investmentWithStage('active', workers.active)
    await investmentWithStage('active', workers.inactive)
    await investmentWithStage('completed', workers.completed)
    await investmentWithStage('active', workers['stage-closed'], true)
  })

  afterAll(async () => {
    for (const id of investmentIds) await deleteTestInvestment(payload, id).catch(() => {})
    await purgeFixtureUsers(db)
  })

  it('offers only a live worker on an open etap of a running investment', async () => {
    const fixtureIds = new Set(Object.values(workers))
    const listed = (await listWorkersWithActiveStages(db)).filter(({ id }) => fixtureIds.has(id))

    expect(listed).toEqual([{ id: workers.active, name: 'Skan active' }])
  })
})

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
    await db.execute(sql`UPDATE investments SET status = ${status} WHERE id = ${id}`)
    return id
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    workerId = await createTestUser(payload, {
      name: 'Nikola Listowy',
      email: 'stage-list@test.local',
    })
    coworkerId = await createTestUser(payload, {
      name: 'Nikola Drugi',
      email: 'stage-list-coworker@test.local',
    })

    await createSite('active', 'active', [{ worker: workerId }, { worker: workerId }])
    await createSite('planowana', 'planowana')
    await createSite('quote', 'quote')
    await createSite('completed', 'completed')
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

  it('drops a site for the coworker whose only etap there is zakończony, not for him', async () => {
    const coworkerSites = await listWorkerStageInvestments(db, coworkerId)

    expect(coworkerSites.map((row) => row.investmentId)).not.toContain(
      investmentIds['coworker-closed'],
    )
  })
})
