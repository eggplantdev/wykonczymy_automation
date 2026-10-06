import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// The ownership filter runs against the real `media` rows; only the reclaim is replaced, so the
// spec reads which ids reached it without deleting fixture rows through the Blob plugin.

vi.mock('server-only', () => ({}))
const { getCurrentUserJwt, reclaimUnreferencedMedia } = vi.hoisted(() => ({
  getCurrentUserJwt: vi.fn(),
  reclaimUnreferencedMedia: vi.fn(),
}))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({ getCurrentUserJwt }))
vi.mock('@/lib/media/delete-unreferenced-media', () => ({ reclaimUnreferencedMedia }))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-971-orphan-'

describe.skipIf(!ENV_READY)('deleteOrphanedMediaAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let deleteOrphanedMediaAction: typeof import('@/lib/actions/delete-orphaned-media').deleteOrphanedMediaAction
  let ownMedia: number
  let foreignMedia: number
  let workerId: number
  let otherUserId: number

  const purge = () =>
    db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)

  async function insertMedia(name: string, uploadedBy: number): Promise<number> {
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, created_by_id)
      VALUES (${`${FILENAME_PREFIX}${name}.jpg`}, 'image/jpeg', 1024, ${uploadedBy})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  const reclaimedIds = () => reclaimUnreferencedMedia.mock.calls.at(-1)?.[1]

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    deleteOrphanedMediaAction = (await import('@/lib/actions/delete-orphaned-media'))
      .deleteOrphanedMediaAction
    await purge()

    const { rows } = await db.execute(sql`SELECT id FROM users ORDER BY id LIMIT 2`)
    workerId = Number(rows[0].id)
    otherUserId = Number(rows[1].id)
    ownMedia = await insertMedia('own', workerId)
    foreignMedia = await insertMedia('foreign', otherUserId)
  })

  beforeEach(() => reclaimUnreferencedMedia.mockReset().mockResolvedValue(undefined))

  afterAll(purge)

  // A worker's failed draft leaves his uploads in Blob; he may clean those, never a manager's page
  // that another form is about to save.
  it('an EMPLOYEE reclaims only the files he uploaded', async () => {
    getCurrentUserJwt.mockResolvedValue({
      id: workerId,
      role: 'EMPLOYEE',
      name: 'E',
      email: 'e@t.pl',
    })

    const result = await deleteOrphanedMediaAction([ownMedia, foreignMedia])

    expect(result.success).toBe(true)
    expect(reclaimedIds()).toEqual([ownMedia])
  })

  it('management reclaims every id it names', async () => {
    getCurrentUserJwt.mockResolvedValue({
      id: workerId,
      role: 'MANAGER',
      name: 'M',
      email: 'm@t.pl',
    })

    await deleteOrphanedMediaAction([ownMedia, foreignMedia])

    expect(reclaimedIds()).toEqual([ownMedia, foreignMedia])
  })
})
