import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots, insertSnapshot, pruneAutoCount } from '@/lib/db/snapshots'
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

// gcSnapshots is raw SQL over now()-relative age windows, so its age caps are only real against the
// DB — backdate taken_at and assert which rows survive, not a return value.
describe.skipIf(!ENV_READY)('gcSnapshots age caps (DB)', () => {
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
      data: { name: 'gc-snapshots-test', status: 'active' },
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

  // Insert a snapshot, then backdate its taken_at by `ageDays` so the age windows can be exercised
  // deterministically (insertSnapshot always stamps now()).
  async function insertAged(kind: 'auto' | 'manual', ageDays: number): Promise<number> {
    const id = await insertSnapshot(db, {
      investmentId,
      kind,
      label: kind === 'manual' ? 'wersja' : null,
      takenBy: null,
      payload: emptyPayload,
    })
    await db.execute(
      sql`UPDATE kosztorys_snapshots SET taken_at = now() - make_interval(days => ${ageDays}) WHERE id = ${id}`,
    )
    return id
  }

  it('drops auto >7 days and manual >1 year, keeps the rest', async () => {
    const freshAuto = await insertAged('auto', 1) // < 7 days → kept
    const oldAuto = await insertAged('auto', 10) // > 7 days → dropped
    const recentManual = await insertAged('manual', 100) // < 1 year → kept
    const ancientManual = await insertAged('manual', 400) // > 1 year → dropped

    await gcSnapshots(db)

    const survivors = await db.execute(
      sql`SELECT id FROM kosztorys_snapshots WHERE investment_id = ${investmentId} ORDER BY id`,
    )
    const survivingIds = survivors.rows.map((r) => Number(r.id))
    expect(survivingIds).toEqual([freshAuto, recentManual].sort((a, b) => a - b))
    expect(survivingIds).not.toContain(oldAuto)
    expect(survivingIds).not.toContain(ancientManual)
  })
})
