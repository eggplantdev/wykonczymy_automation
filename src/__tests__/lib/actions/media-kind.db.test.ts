import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

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
    payload = await bootTestPayload()
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
    Object.assign(authState, { userId: 1, role: 'ADMIN' })
  })

  afterAll(purge)

  it('stamps the kind on the stored row', async () => {
    const result = await setMediaKindAction(mediaId, 'projekt')

    expect(result.success).toBe(true)
    expect(await storedKind()).toBe('projekt')
  })

  it('leaves the row untouched for an EMPLOYEE', async () => {
    authState.role = 'EMPLOYEE'

    const result = await setMediaKindAction(mediaId, 'projekt')

    expect(result).toEqual({ success: false, error: 'Brak uprawnień' })
    expect(await storedKind()).toBeNull()
  })
})
