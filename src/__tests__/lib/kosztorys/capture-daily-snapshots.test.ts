import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { listDailyEligibleInvestmentIds } from '@/lib/db/snapshots'
import {
  captureDailySnapshot,
  endOfPreviousWarsawDay,
} from '@/lib/kosztorys/capture-daily-snapshots'
import { toWarsawDay } from '@/lib/utils/days'
import {
  createTestInvestment,
  deleteTestInvestment,
  trashDaysAgo,
} from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { acquireTestWorkshop } from '@/__tests__/helpers/workshop'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// Both cron firings: 23:15 UTC is 00:15 Warsaw in winter and 01:15 in summer. Either way the version
// belongs to the Warsaw day that just ended.
describe('endOfPreviousWarsawDay', () => {
  it.each([
    ['winter', '2026-01-14T23:15:00.000Z', '2026-01-14', '2026-01-14T22:59:59.999Z'],
    ['summer', '2026-07-14T23:15:00.000Z', '2026-07-14', '2026-07-14T21:59:59.999Z'],
    // The night the clocks go forward: the day that ended was still on winter time.
    ['spring DST night', '2026-03-29T23:15:00.000Z', '2026-03-29', '2026-03-29T21:59:59.999Z'],
    ['autumn DST night', '2026-10-25T23:15:00.000Z', '2026-10-25', '2026-10-25T22:59:59.999Z'],
  ])('%s run stamps the last instant of the Warsaw day before', (_, now, day, instant) => {
    const takenAt = endOfPreviousWarsawDay(new Date(now))
    expect(takenAt.toISOString()).toBe(instant)
    expect(toWarsawDay(takenAt)).toBe(day)
  })
})

describe.skipIf(!ENV_READY)('captureDailySnapshot (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []

  const day = (iso: string) => new Date(iso)
  const DAY_1 = day('2026-01-14T22:59:59.999Z')
  const DAY_2 = day('2026-01-15T22:59:59.999Z')
  const DAY_3 = day('2026-01-16T22:59:59.999Z')

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestInvestment(payload, id)
  })

  async function investment(name: string, overrides = {}) {
    const id = await createTestInvestment(payload, name, overrides)
    created.push(id)
    return id
  }

  async function dailyRows(investmentId: number) {
    const res = await db.execute(sql`
      SELECT taken_at, payload FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'daily' ORDER BY taken_at
    `)
    return res.rows
  }

  it('stores the first day, skips an unchanged one, and stores again after an edit', async () => {
    const investmentId = await investment('daily-capture-flow')
    const tree = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Łazienka', items: [{ description: 'Płytki', plannedQty: 10, clientPrice: 100 }] },
      ],
    })
    await db.execute(sql`
      UPDATE investments SET global_discount_type = 'amount', global_discount_value = 250
      WHERE id = ${investmentId}
    `)

    expect(await captureDailySnapshot(db, investmentId, DAY_1)).toBe('stored')
    expect(await captureDailySnapshot(db, investmentId, DAY_2)).toBe('unchanged')

    const setQty = (plannedQty: number) =>
      payload.update({
        collection: 'kosztorys-items',
        id: tree.itemIds[0],
        data: { plannedQty },
        context: { skipRevalidation: true },
      })

    await setQty(12)
    expect(await captureDailySnapshot(db, investmentId, DAY_2)).toBe('stored')
    // A rerun of a day already captured stays a no-op even when the tree moved since — that edit
    // belongs to the next day.
    await setQty(14)
    expect(await captureDailySnapshot(db, investmentId, DAY_2)).toBe('unchanged')
    expect(await captureDailySnapshot(db, investmentId, DAY_3)).toBe('stored')

    const rows = await dailyRows(investmentId)
    expect(rows.map((row) => new Date(row.taken_at as string).toISOString())).toEqual([
      DAY_1.toISOString(),
      DAY_2.toISOString(),
      DAY_3.toISOString(),
    ])
    expect(rows[0].payload).toMatchObject({ globalDiscount: { type: 'amount', value: 250 } })
  })

  it('offers only open, untrashed, non-szablon investments to the night run', async () => {
    const active = await investment('daily-eligible-active')
    const planned = await investment('daily-eligible-planned', { status: 'planowana' })
    const completed = await investment('daily-eligible-completed', { status: 'completed' })
    const workshop = await acquireTestWorkshop(payload)
    const trashed = await investment('daily-eligible-trashed')
    await trashDaysAgo(db, trashed, 1)

    try {
      const eligible = await listDailyEligibleInvestmentIds(db)
      expect(eligible).toEqual(expect.arrayContaining([active, planned]))
      for (const id of [completed, workshop.id, trashed]) expect(eligible).not.toContain(id)
    } finally {
      await workshop.release()
    }
  })
})
