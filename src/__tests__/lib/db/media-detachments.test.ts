import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { closeDetachments, recordDetachments } from '@/lib/db/media-detachments'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'kosz-plikow-detachments-'

describe.skipIf(!ENV_READY)('media detachments (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  const purgeMedia = () =>
    db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)

  const createMedia = async (name: string) => {
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, kind)
      VALUES (${`${FILENAME_PREFIX}${name}`}, 'image/jpeg', 1024, 'zdjecie')
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  const entriesOf = async (mediaId: number) => {
    const { rows } = await db.execute(sql`
      SELECT from_collection, from_field, from_id, detached_at, restored_at
      FROM media_detachments WHERE media_id = ${mediaId} ORDER BY id
    `)
    return rows
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
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
})
