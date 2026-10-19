import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { CollectionBeforeDeleteHook, Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import { preventReferencedMediaDelete } from '@/collections/hooks/media/prevent-referenced-delete'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// `assets` is investments' first relationship field, so this asserts the join table the migration
// created actually matches what Payload writes into it — a shape a mocked `payload.update` cannot
// see.

const NAME = 'EX-802 investment assets'
const FILENAMES = ['ex-802-a.jpg', 'ex-802-b.jpg']
const FILENAME_PREFIX = 'ex-802-'

describe.skipIf(!ENV_READY)('investment asset actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let mediaIds: number[]
  let actions: typeof import('@/lib/actions/investment-assets')

  const purge = async () => {
    await db.execute(sql`DELETE FROM investments WHERE name = ${NAME}`)
    await purgeTestMedia(db, FILENAME_PREFIX)
  }

  const attachedIds = async () => {
    const { rows } = await db.execute(sql`
      SELECT media_id FROM investments_rels
      WHERE parent_id = ${investmentId} AND path = 'assets'
      ORDER BY "order"
    `)
    return rows.map((row) => Number(row.media_id))
  }

  const mediaExists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT id FROM media WHERE id = ${id}`)
    return rows.length > 0
  }

  const openDetachments = async () => {
    const { rows } = await db.execute(sql`
      SELECT media_id, from_collection, from_field, from_id FROM media_detachments
      WHERE media_id IN (${sqlList(mediaIds)})
        AND restored_at IS NULL
      ORDER BY media_id
    `)
    return rows.map((row) => ({ ...row, media_id: Number(row.media_id) }))
  }

  beforeAll(async () => {
    authState.role = 'ADMIN'
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/investment-assets')
  })

  // A detach leaves an open trash entry behind, which the next test would read as its own.
  beforeEach(async () => {
    await purge()

    mediaIds = []
    for (const filename of FILENAMES) mediaIds.push(await insertTestMedia(db, filename))

    investmentId = await createTestInvestment(payload, NAME)
  })

  afterAll(purge)

  it('persists a batch of ids in the order they were attached', async () => {
    const result = await actions.addInvestmentAssetsAction(investmentId, mediaIds)

    expect(result.success).toBe(true)
    expect(await attachedIds()).toEqual(mediaIds)
  })

  it('leaves the remaining files in order when one is removed', async () => {
    await actions.addInvestmentAssetsAction(investmentId, mediaIds)

    const result = await actions.removeInvestmentAssetAction(investmentId, mediaIds[0])

    expect(result.success).toBe(true)
    expect(await attachedIds()).toEqual([mediaIds[1]])
    expect(await mediaExists(mediaIds[0])).toBe(true)
    expect(await openDetachments()).toEqual([
      {
        media_id: mediaIds[0],
        from_collection: 'investments',
        from_field: 'assets',
        from_id: investmentId,
      },
    ])
  })

  it('takes a re-attached file back out of the trash', async () => {
    await actions.addInvestmentAssetsAction(investmentId, mediaIds)
    await actions.removeInvestmentAssetAction(investmentId, mediaIds[0])

    await actions.addInvestmentAssetsAction(investmentId, [mediaIds[0]])

    expect(await attachedIds()).toEqual([mediaIds[1], mediaIds[0]])
    expect(await openDetachments()).toEqual([])
  })

  it('clears the whole set and moves every file to the trash when all are removed', async () => {
    await actions.addInvestmentAssetsAction(investmentId, mediaIds)

    const result = await actions.removeAllInvestmentAssetsAction(investmentId)

    expect(result.success).toBe(true)
    expect(await attachedIds()).toEqual([])
    expect(await mediaExists(mediaIds[0])).toBe(true)
    expect(await mediaExists(mediaIds[1])).toBe(true)
    expect((await openDetachments()).map((entry) => entry.media_id)).toEqual(mediaIds)
  })

  it('refuses to delete a media row an investment points at', async () => {
    await actions.addInvestmentAssetsAction(investmentId, [mediaIds[0]])

    // The probes run on the delete's own `req`, so the user is load-bearing: `investments` is
    // read-gated to management and an anonymous probe counts zero references — i.e. it would let
    // the file go.
    const run = () =>
      preventReferencedMediaDelete({
        id: mediaIds[0],
        req: { payload, user: { id: 1, role: 'ADMIN' } },
      } as unknown as Parameters<CollectionBeforeDeleteHook>[0])

    await expect(run()).rejects.toThrow('inwestycje: 1')
  })
})
