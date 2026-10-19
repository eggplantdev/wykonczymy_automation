import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { findReferencedMediaIds } from '@/lib/db/media-detachments'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { purgeFixtureUsers } from '@/__tests__/helpers/user'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { createRegisterOwner } from '@/__tests__/helpers/register'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// The reclaim is replaced so the fixture row never reaches the Blob plugin.

const MARKER = 'delete-invoice-media'
const FILENAME_PREFIX = 'delete-invoice-media-'

describe.skipIf(!ENV_READY)('deleting an expense reclaims its faktura (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

  const purge = async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeTestMedia(db, FILENAME_PREFIX)
    await purgeFixtureUsers(db)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purge()
    ;({ registerId } = await createRegisterOwner(
      payload,
      {
        name: 'Delete Invoice Owner',
        email: 'delete-invoice@test.local',
        registerName: 'delete-invoice-register',
      },
      ctx,
    ))
  })

  afterAll(purge)

  it('hands the faktura to the reclaim, which finds it unreferenced after the commit', async () => {
    vi.mocked(reclaimUnreferencedMedia).mockResolvedValue(undefined)
    const mediaId = await insertTestMedia(db, `${FILENAME_PREFIX}fv.jpg`, { kind: null })
    const expense = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} expense`,
        amount: 100,
        date: '2026-10-19T09:00:00.000Z',
        type: 'OTHER_DEPOSIT',
        paymentMethod: 'CASH',
        sourceRegister: registerId,
        invoice: [mediaId],
      },
      overrideAccess: true,
      ...ctx,
    })

    await payload.delete({
      collection: 'transactions',
      id: expense.id,
      overrideAccess: true,
      ...ctx,
    })

    expect(vi.mocked(reclaimUnreferencedMedia).mock.calls.at(-1)?.[1]).toEqual([mediaId])
    expect(await findReferencedMediaIds(db, [mediaId])).toEqual([])
  })
})
