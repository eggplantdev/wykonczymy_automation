import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertMediaRow } from '@/lib/db/media'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-1012-media-'

describe.skipIf(!ENV_READY)('insertMediaRow (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let uploaderId: number

  const purgeMedia = () =>
    db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await purgeMedia()
    await purgeFixtureUsers(db)

    const uploader = await payload.create({
      collection: 'users',
      data: {
        name: 'Fast Upload Worker',
        role: 'EMPLOYEE',
        email: 'fast-upload-worker@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    uploaderId = Number(uploader.id)
  })

  afterAll(async () => {
    if (!db) return
    await purgeMedia()
    await purgeFixtureUsers(db)
  })

  // Payload's `/api/media/file/<filename>` and every reader that renders `media.url` must treat the
  // row as one Payload made, and the ownership CTE reads `created_by_id`.
  it('persists the row the way a Payload upload would', async () => {
    const filename = `${FILENAME_PREFIX}paragon ł.jpg`
    const id = await insertMediaRow(db, {
      filename,
      mimeType: 'image/jpeg',
      filesize: 305_000,
      kind: 'faktura',
      createdById: uploaderId,
    })

    const { rows } = await db.execute(sql`
      SELECT filename, url, mime_type, filesize, kind, created_by_id, created_at, updated_at
      FROM media WHERE id = ${id}
    `)
    expect(rows[0]).toMatchObject({
      filename,
      url: `/api/media/file/${encodeURIComponent(filename)}`,
      mime_type: 'image/jpeg',
      kind: 'faktura',
      created_by_id: uploaderId,
    })
    expect(Number(rows[0].filesize)).toBe(305_000)
    expect(rows[0].created_at).not.toBeNull()
    expect(rows[0].updated_at).not.toBeNull()
  })

  it('stores no kind when none is given', async () => {
    const id = await insertMediaRow(db, {
      filename: `${FILENAME_PREFIX}no-kind.pdf`,
      mimeType: 'application/pdf',
      filesize: 100_000,
      kind: null,
      createdById: uploaderId,
    })

    const { rows } = await db.execute(sql`SELECT kind FROM media WHERE id = ${id}`)
    expect(rows[0].kind).toBeNull()
  })
})
