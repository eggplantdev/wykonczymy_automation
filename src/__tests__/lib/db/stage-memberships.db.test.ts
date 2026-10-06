import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { listWorkersWithActiveStages } from '@/lib/db/stage-memberships'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('listWorkersWithActiveStages (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const investmentIds: number[] = []
  const workers: Record<string, number> = {}

  async function investmentWithStage(status: InvestmentStatusT, workerId: number) {
    const id = await createTestInvestment(payload, `EX-949 scan workers ${status}`, { status })
    investmentIds.push(id)
    await createKosztorysTree(payload, id, { sections: [], stages: [{ worker: workerId }] })
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    for (const name of ['active', 'inactive', 'szablon', 'completed']) {
      const created = await payload.create({
        collection: 'users',
        data: {
          name: `Skan ${name}`,
          role: 'EMPLOYEE',
          email: `scan-list-${name}@test.local`,
          password: 'test-password-123',
        },
        context: { skipRevalidation: true },
      })
      workers[name] = Number(created.id)
    }
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${workers.inactive}`)

    await investmentWithStage('active', workers.active)
    await investmentWithStage('active', workers.inactive)
    await investmentWithStage('szablon', workers.szablon)
    await investmentWithStage('completed', workers.completed)
  })

  afterAll(async () => {
    for (const id of investmentIds) await deleteTestInvestment(payload, id).catch(() => {})
    await purgeFixtureUsers(db)
  })

  it('offers only a live worker on an etap of a running investment', async () => {
    const fixtureIds = new Set(Object.values(workers))
    const listed = (await listWorkersWithActiveStages(db)).filter(({ id }) => fixtureIds.has(id))

    expect(listed).toEqual([{ id: workers.active, name: 'Skan active' }])
  })
})
