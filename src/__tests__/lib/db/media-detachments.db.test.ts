import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { getDb } from '@/lib/db/get-db'
import { closeDetachments, fetchDetachedFiles, recordDetachments } from '@/lib/db/media-detachments'

const FILENAME_PREFIX = 'kosz-plikow-detachments-'

describe.skipIf(!ENV_READY)('media detachments (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  const purgeMedia = () => purgeTestMedia(db, FILENAME_PREFIX)
  const createMedia = (name: string) => insertTestMedia(db, `${FILENAME_PREFIX}${name}`)

  const entriesOf = async (mediaId: number) => {
    const { rows } = await db.execute(sql`
      SELECT from_collection, from_field, from_id, detached_at, restored_at
      FROM media_detachments WHERE media_id = ${mediaId} ORDER BY id
    `)
    return rows
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeMedia()
  })

  afterAll(async () => {
    if (!db) return
    await purgeMedia()
  })

  it('records where each detached file came from and leaves it in the trash', async () => {
    const photo = await createMedia('photo.jpg')
    const plan = await createMedia('plan.jpg')

    await recordDetachments(db, { collection: 'investments', field: 'assets', id: 41 }, [
      photo,
      plan,
    ])

    for (const mediaId of [photo, plan]) {
      const entries = await entriesOf(mediaId)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        from_collection: 'investments',
        from_field: 'assets',
        from_id: 41,
        restored_at: null,
      })
      expect(entries[0].detached_at).not.toBeNull()
    }
  })

  it('keeps one open entry per file, pointing at the latest source', async () => {
    const shared = await createMedia('shared.jpg')

    await recordDetachments(db, { collection: 'investments', field: 'assets', id: 41 }, [shared])
    await recordDetachments(db, { collection: 'leads', field: 'assets', id: 7 }, [shared])

    const entries = await entriesOf(shared)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ from_collection: 'leads', from_id: 7, restored_at: null })
  })

  it('closes the open entry on re-attach and leaves an already closed one as it was', async () => {
    const invoice = await createMedia('invoice.jpg')
    const target = { collection: 'transactions', field: 'invoice', id: 9 } as const

    await recordDetachments(db, target, [invoice])
    await closeDetachments(db, [invoice])
    const [firstClosed] = await entriesOf(invoice)

    await recordDetachments(db, target, [invoice])
    await closeDetachments(db, [invoice])

    const entries = await entriesOf(invoice)
    expect(entries).toHaveLength(2)
    expect(entries[0].restored_at).toEqual(firstClosed.restored_at)
    expect(entries.every((entry) => entry.restored_at !== null)).toBe(true)
  })

  it('lists only the files whose source still exists, naming the investment they left', async () => {
    const { rows } = await db.execute(sql`SELECT id, name FROM investments ORDER BY id LIMIT 1`)
    const investment = { id: Number(rows[0].id), name: String(rows[0].name) }
    const kept = await createMedia('kept.jpg')
    const sourceless = await createMedia('sourceless.jpg')
    const parentGone = await createMedia('parent-gone.jpg')
    await recordDetachments(db, { collection: 'investments', field: 'assets', id: investment.id }, [
      kept,
    ])
    await db.execute(sql`INSERT INTO media_detachments (media_id) VALUES (${sourceless})`)
    await recordDetachments(db, { collection: 'investments', field: 'assets', id: -1 }, [
      parentGone,
    ])

    const files = await fetchDetachedFiles(db)
    const listed = files.filter((row) => [kept, sourceless, parentGone].includes(row.mediaId))

    expect(listed).toEqual([
      expect.objectContaining({
        mediaId: kept,
        filename: `${FILENAME_PREFIX}kept.jpg`,
        parent: expect.objectContaining({ kind: 'investment', ...investment }),
      }),
    ])
    const [entry] = await fetchDetachedFiles(db, listed[0].id)
    expect(entry?.mediaId).toBe(kept)
  })

  it('leaves out a file another record still holds', async () => {
    const { rows } = await db.execute(sql`SELECT id FROM investments ORDER BY id LIMIT 2`)
    const [source, holder] = rows.map((row) => Number(row.id))
    const shared = await createMedia('still-held.jpg')
    await recordDetachments(db, { collection: 'investments', field: 'assets', id: source }, [
      shared,
    ])
    await db.execute(sql`
      INSERT INTO investments_rels (parent_id, path, media_id, "order")
      VALUES (${holder}, 'assets', ${shared}, 999)
    `)

    const files = await fetchDetachedFiles(db)

    expect(files.map((row) => row.mediaId)).not.toContain(shared)
  })
})
