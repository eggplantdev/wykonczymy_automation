import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { deleteOrphanedMediaAction } from '@/lib/actions/delete-orphaned-media'

// The ownership filter runs against the real `media` rows; only the reclaim is replaced, so the
// spec reads which ids reached it without deleting fixture rows through the Blob plugin.

const FILENAME_PREFIX = 'ex-971-orphan-'

describe.skipIf(!ENV_READY)('deleteOrphanedMediaAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownMedia: number
  let foreignMedia: number
  let workerId: number
  let otherUserId: number

  const purge = () => purgeTestMedia(db, FILENAME_PREFIX)

  const insertMedia = (name: string, uploadedBy: number) =>
    insertTestMedia(db, `${FILENAME_PREFIX}${name}.jpg`, { kind: null, createdById: uploadedBy })

  const reclaimedIds = () => vi.mocked(reclaimUnreferencedMedia).mock.calls.at(-1)?.[1]

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purge()

    const { rows } = await db.execute(sql`SELECT id FROM users ORDER BY id LIMIT 2`)
    workerId = Number(rows[0].id)
    otherUserId = Number(rows[1].id)
    ownMedia = await insertMedia('own', workerId)
    foreignMedia = await insertMedia('foreign', otherUserId)
  })

  beforeEach(() => vi.mocked(reclaimUnreferencedMedia).mockResolvedValue(undefined))

  afterAll(purge)

  it('an EMPLOYEE reclaims only the files he uploaded', async () => {
    Object.assign(authState, { userId: workerId, role: 'EMPLOYEE' })

    const result = await deleteOrphanedMediaAction([ownMedia, foreignMedia])

    expect(result.success).toBe(true)
    expect(reclaimedIds()).toEqual([ownMedia])
  })

  it('management reclaims every id it names', async () => {
    Object.assign(authState, { userId: workerId, role: 'MANAGER' })

    await deleteOrphanedMediaAction([ownMedia, foreignMedia])

    expect(reclaimedIds()).toEqual([ownMedia, foreignMedia])
  })
})
