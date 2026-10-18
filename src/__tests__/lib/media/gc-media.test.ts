import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { getDb } from '@/lib/db/get-db'
import { recordDetachments } from '@/lib/db/media-detachments'
import { gcMedia } from '@/lib/media/gc-media'
import { MEDIA_HOLDER_TABLES } from '@/lib/media/relating-collections'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'kosz-plikow-gc-'

describe.skipIf(!ENV_READY)('gcMedia (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  const purgeMedia = () => purgeTestMedia(db, FILENAME_PREFIX)
  const createMedia = (name: string) => insertTestMedia(db, `${FILENAME_PREFIX}${name}`)

  const firstId = async (table: 'investments' | 'worker_expense_drafts' | 'worker_reports') => {
    const { rows } = await db.execute(
      sql`SELECT id FROM ${sql.identifier(table)} ORDER BY id LIMIT 1`,
    )
    expect(rows[0], `the test DB holds no ${table}`).toBeDefined()
    return Number(rows[0].id)
  }

  const ageEntry = (mediaId: number, days: number) =>
    db.execute(sql`
      UPDATE media_detachments SET detached_at = now() - make_interval(days => ${days})
      WHERE media_id = ${mediaId} AND restored_at IS NULL
    `)

  const openEntryOf = async (mediaId: number) => {
    const { rows } = await db.execute(sql`
      SELECT from_collection FROM media_detachments
      WHERE media_id = ${mediaId} AND restored_at IS NULL
    `)
    return rows[0]
  }

  const mediaExists = async (mediaId: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM media WHERE id = ${mediaId}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeMedia()
    // The test DB's own orphans get recorded by every run; left to age past the retention window,
    // the next run would delete real files from the Blob store.
    await db.execute(sql`DELETE FROM media_detachments`)
  })

  afterAll(async () => {
    if (!db) return
    await purgeMedia()
    await db.execute(sql`DELETE FROM media_detachments`)
  })

  it('moves an unreferenced file into the trash without a known source', async () => {
    const orphan = await createMedia('orphan.jpg')

    await gcMedia(payload, db)

    expect(await openEntryOf(orphan)).toMatchObject({ from_collection: null })
    expect(await mediaExists(orphan)).toBe(true)
  })

  it('leaves a worker receipt and a report photo out of the trash', async () => {
    const receipt = await createMedia('receipt.jpg')
    const reportPhoto = await createMedia('report.jpg')
    await db.execute(sql`
      INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
      VALUES (${await firstId('worker_expense_drafts')}, ${receipt}, 999)
    `)
    await db.execute(sql`
      INSERT INTO worker_report_media (report_id, media_id, position)
      VALUES (${await firstId('worker_reports')}, ${reportPhoto}, 999)
    `)

    await gcMedia(payload, db)

    expect(await openEntryOf(receipt)).toBeUndefined()
    expect(await openEntryOf(reportPhoto)).toBeUndefined()
  })

  it('takes a file that is attached again back out of the trash, however old its entry', async () => {
    const reattached = await createMedia('reattached.jpg')
    await recordDetachments(db, { collection: 'investments', field: 'assets', id: 1 }, [reattached])
    await ageEntry(reattached, 10)
    await db.execute(sql`
      INSERT INTO investments_rels (parent_id, path, media_id, "order")
      VALUES (${await firstId('investments')}, 'assets', ${reattached}, 999)
    `)

    const result = await gcMedia(payload, db)

    expect(result.healed).toBeGreaterThanOrEqual(1)
    expect(await openEntryOf(reattached)).toBeUndefined()
    expect(await mediaExists(reattached)).toBe(true)
  })

  it('deletes a file past the retention window and keeps a fresh one', async () => {
    const expired = await createMedia('expired.jpg')
    const fresh = await createMedia('fresh.jpg')
    const source = { collection: 'transactions' as const, field: 'invoice', id: 1 }
    await recordDetachments(db, source, [expired, fresh])
    await ageEntry(expired, 10)
    await ageEntry(fresh, 2)

    const result = await gcMedia(payload, db)

    expect(result).toMatchObject({ deleted: 1, failed: 0 })
    expect(await mediaExists(expired)).toBe(false)
    expect(await mediaExists(fresh)).toBe(true)
    expect(await openEntryOf(fresh)).toMatchObject({ from_collection: 'transactions' })
  })

  it('counts every table that links to a file as holding it', async () => {
    const { rows } = await db.execute(sql`
      SELECT DISTINCT tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'media'
    `)
    const notHolders = ['media_detachments', 'payload_locked_documents_rels']
    const linking = rows.map((row) => String(row.table_name)).filter((t) => !notHolders.includes(t))

    expect(linking.sort()).toEqual([...MEDIA_HOLDER_TABLES].sort())
  })

  it('changes nothing on a second run', async () => {
    await gcMedia(payload, db)

    expect(await gcMedia(payload, db)).toEqual({ recorded: 0, healed: 0, deleted: 0, failed: 0 })
  })
})
