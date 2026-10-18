import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { insertTestMedia } from '@/__tests__/helpers/media'
import { getDb } from '@/lib/db/get-db'
import { authState } from '@/__tests__/stubs/require-auth'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const NAME = 'kosz-plikow restore'
const FILENAME = 'kosz-plikow-restore.jpg'

describe.skipIf(!ENV_READY)('restoreDetachedFileAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let mediaId: number
  let assets: typeof import('@/lib/actions/investment-assets')
  let restoreDetachedFileAction: typeof import('@/lib/actions/media-trash').restoreDetachedFileAction

  const purge = async () => {
    await db.execute(sql`DELETE FROM investments WHERE name = ${NAME}`)
    await db.execute(sql`DELETE FROM media WHERE filename = ${FILENAME}`)
  }

  const attachedIds = async () => {
    const { rows } = await db.execute(sql`
      SELECT media_id FROM investments_rels WHERE parent_id = ${investmentId} AND path = 'assets'
    `)
    return rows.map((row) => Number(row.media_id))
  }

  const openDetachmentId = async () => {
    const { rows } = await db.execute(sql`
      SELECT id FROM media_detachments WHERE media_id = ${mediaId} AND restored_at IS NULL
    `)
    return rows[0] ? Number(rows[0].id) : undefined
  }

  beforeAll(async () => {
    authState.role = 'ADMIN'
    payload = await bootTestPayload()
    db = await getDb(payload)
    assets = await import('@/lib/actions/investment-assets')
    ;({ restoreDetachedFileAction } = await import('@/lib/actions/media-trash'))
  })

  beforeEach(async () => {
    await purge()
    mediaId = await insertTestMedia(db, FILENAME)
    investmentId = await createTestInvestment(payload, NAME)
    await assets.addInvestmentAssetsAction(investmentId, [mediaId])
    await assets.removeInvestmentAssetAction(investmentId, mediaId)
  })

  afterAll(purge)

  it('puts the file back into the gallery it left and takes it out of the trash', async () => {
    const result = await restoreDetachedFileAction((await openDetachmentId()) as number)

    expect(result.success).toBe(true)
    expect(await attachedIds()).toEqual([mediaId])
    expect(await openDetachmentId()).toBeUndefined()
  })

  it('refuses while the investment itself lies in the trash', async () => {
    await db.execute(sql`UPDATE investments SET trashed_at = now() WHERE id = ${investmentId}`)

    const result = await restoreDetachedFileAction((await openDetachmentId()) as number)

    expect(result).toEqual({ success: false, error: 'Najpierw przywróć inwestycję z Kosza.' })
    expect(await attachedIds()).toEqual([])
    expect(await openDetachmentId()).toBeDefined()
  })
})
