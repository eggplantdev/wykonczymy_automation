import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { addStageProgress } from '@/lib/db/stage-progress'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('addStageProgress (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let itemIds: number[]
  let stageId: number
  let otherStageId: number

  async function qtyDone(itemId: number, stage: number): Promise<number | null> {
    const res = await db.execute(
      sql`SELECT qty_done FROM stage_progress WHERE item_id = ${itemId} AND stage_id = ${stage}`,
    )
    return res.rows[0] ? Number(res.rows[0].qty_done) : null
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'stage-progress-add-test')
    otherInvestmentId = await createTestInvestment(payload, 'stage-progress-add-test-other')
    const tree = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Salon', items: [{ description: 'Malowanie' }, { description: 'Gładź' }] },
      ],
      stages: [{ label: 'Etap 1' }],
      progress: [{ item: 0, stage: 0, qtyDone: 4 }],
    })
    itemIds = tree.itemIds
    stageId = tree.stageIds[0]
    const other = await createKosztorysTree(payload, otherInvestmentId, {
      sections: [{ name: 'Obca', items: [{ description: 'Obca pozycja' }] }],
      stages: [{ label: 'Obcy etap' }],
    })
    otherStageId = other.stageIds[0]
  })

  afterAll(async () => {
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('adds to an existing cell and creates a missing one, returning the absolute figures', async () => {
    const cells = await addStageProgress(
      db,
      investmentId,
      stageId,
      new Map([
        [itemIds[0], 1.5],
        [itemIds[1], 2],
      ]),
    )

    expect(await qtyDone(itemIds[0], stageId)).toBe(5.5)
    expect(await qtyDone(itemIds[1], stageId)).toBe(2)
    expect(cells.sort((a, b) => a.itemId - b.itemId)).toEqual([
      { itemId: itemIds[0], stageId, qtyDone: 5.5 },
      { itemId: itemIds[1], stageId, qtyDone: 2 },
    ])
  })

  it('writes nothing into an etap of another investment', async () => {
    const cells = await addStageProgress(db, investmentId, otherStageId, new Map([[itemIds[0], 7]]))

    expect(cells).toEqual([])
    expect(await qtyDone(itemIds[0], otherStageId)).toBeNull()
  })
})
