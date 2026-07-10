import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertSnapshot, pruneAutoCount } from '@/lib/db/snapshots'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// pruneAutoCount is raw SQL, so its "keep newest 50 auto, never touch manual" invariant is only real
// against the DB — assert persisted row counts, not a return value.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const emptyPayload: SnapshotPayloadT = {
  schemaVersion: 1,
  sections: [],
  items: [],
  stages: [],
  progress: [],
  settings: { wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 },
}

describe.skipIf(!ENV_READY)('pruneAutoCount (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const investment = await payload.create({
      collection: 'investments',
      data: { name: 'prune-auto-test', status: 'active' },
      context: { skipRevalidation: true },
    })
    investmentId = Number(investment.id)
  })

  afterAll(async () => {
    if (investmentId) {
      await payload.delete({
        collection: 'investments',
        id: investmentId,
        context: { skipRevalidation: true },
      })
    }
  })

  async function count(kind: 'auto' | 'manual'): Promise<number> {
    const res = await db.execute(
      sql`SELECT COUNT(*) AS n FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = ${kind}`,
    )
    return Number(res.rows[0].n)
  }

  it('keeps only the newest 50 auto snapshots and never touches manual', async () => {
    const autoIds: number[] = []
    for (let i = 0; i < 55; i++) {
      autoIds.push(
        await insertSnapshot(db, {
          investmentId,
          kind: 'auto',
          label: null,
          takenBy: null,
          payload: emptyPayload,
        }),
      )
    }
    for (let i = 0; i < 3; i++) {
      await insertSnapshot(db, {
        investmentId,
        kind: 'manual',
        label: `wersja ${i}`,
        takenBy: null,
        payload: emptyPayload,
      })
    }
    expect(await count('auto')).toBe(55)

    await pruneAutoCount(db, investmentId)

    expect(await count('auto')).toBe(50)
    expect(await count('manual')).toBe(3)

    // The 5 OLDEST (lowest-id) auto rows are the ones dropped; the newest 50 survive.
    const survivors = await db.execute(
      sql`SELECT id FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = 'auto' ORDER BY id`,
    )
    const survivingIds = survivors.rows.map((r) => Number(r.id))
    expect(survivingIds).toEqual(autoIds.slice(5))
  })
})
