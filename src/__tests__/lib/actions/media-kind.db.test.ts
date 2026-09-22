import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// Asserted on the `media` row, not on the action's result: a `{ success: true }` sits on top of
// whatever the write really did. The refusal leg mocks the SESSION rather than `requireAuth`, so
// the role gate under test is the real one — a mocked guard would only assert the mock.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
const { getCurrentUserJwt } = vi.hoisted(() => ({ getCurrentUserJwt: vi.fn() }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({ getCurrentUserJwt }))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME = 'ex-829-rzut.jpg'

describe.skipIf(!ENV_READY)('setMediaKindAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let mediaId: number
  let setMediaKindAction: typeof import('@/lib/actions/media-kind').setMediaKindAction

  const purge = () => db.execute(sql`DELETE FROM media WHERE filename = ${FILENAME}`)

  const storedKind = async () => {
    const { rows } = await db.execute(sql`SELECT kind FROM media WHERE id = ${mediaId}`)
    return rows[0]?.kind ?? null
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    setMediaKindAction = (await import('@/lib/actions/media-kind')).setMediaKindAction
  })

  beforeEach(async () => {
    await purge()
    // Raw INSERT rather than payload.create: an upload through Payload would push bytes at the Blob
    // store for a fixture nothing ever opens.
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize)
      VALUES (${FILENAME}, 'image/jpeg', 1024)
      RETURNING id
    `)
    mediaId = Number(rows[0].id)
    getCurrentUserJwt.mockResolvedValue({ id: 1, role: 'ADMIN', name: 'T', email: 't@t.pl' })
  })

  afterAll(purge)

  it('stamps the kind on the stored row', async () => {
    const result = await setMediaKindAction(mediaId, 'projekt')

    expect(result.success).toBe(true)
    expect(await storedKind()).toBe('projekt')
  })

  it('leaves the row untouched for an EMPLOYEE', async () => {
    getCurrentUserJwt.mockResolvedValue({ id: 2, role: 'EMPLOYEE', name: 'E', email: 'e@t.pl' })

    const result = await setMediaKindAction(mediaId, 'projekt')

    expect(result).toEqual({ success: false, error: 'Brak uprawnień' })
    expect(await storedKind()).toBeNull()
  })
})
