import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The purge is the one delete nobody confirms, so the assertion is on which rows survive — a count
// in the result would read the same over a purge that deleted the wrong investment.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'kosz-inwestycji purge'

describe.skipIf(!ENV_READY)('purgeTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: number
  let used: number
  let recent: number

  const purge = () => db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${PREFIX}%`}`)

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id}`)
    return rows.length > 0
  }

  const trashDaysAgo = (id: number, days: number) =>
    db.execute(sql`
      UPDATE investments SET trashed_at = now() - make_interval(days => ${days}) WHERE id = ${id}
    `)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purge()

    expired = await createTestInvestment(payload, `${PREFIX} expired`)
    await createKosztorysTree(payload, expired, {
      sections: [{ name: 'S', items: [{ plannedQty: 0, clientPrice: 50 }] }],
    })
    used = await createTestInvestment(payload, `${PREFIX} used`)
    await createKosztorysTree(payload, used, {
      sections: [{ name: 'S', items: [{ plannedQty: 3 }] }],
    })
    recent = await createTestInvestment(payload, `${PREFIX} recent`)

    await trashDaysAgo(expired, 31)
    await trashDaysAgo(used, 31)
    await trashDaysAgo(recent, 29)
  })

  afterAll(purge)

  it('deletes only the unused investment past retention', async () => {
    const { purgeTrash } = await import('@/lib/investments/purge-trash')

    const result = await purgeTrash(payload, db)

    expect(await exists(expired)).toBe(false)
    expect(await exists(used)).toBe(true)
    expect(await exists(recent)).toBe(true)
    expect(result.purged).toBeGreaterThanOrEqual(1)
    expect(result.skippedKosztorys).toBeGreaterThanOrEqual(1)
    expect(result.failed).toBe(0)
  })
})
