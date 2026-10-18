import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { insertTestMedia } from '@/__tests__/helpers/media'
import { getDb } from '@/lib/db/get-db'
import { recordDetachments } from '@/lib/db/media-detachments'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const NAME = `kosz-plikow erase ${Date.now()}`
const FILENAME = 'kosz-plikow-erase.jpg'

describe.skipIf(!ENV_READY)('eraseTrashedLead (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let leadId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    const lead = await payload.create({
      collection: 'leads',
      data: {
        source: 'website_form',
        name: NAME,
        contactStatus: 'new',
        notifyStatus: 'sent',
        autoReplyStatus: 'skipped',
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    leadId = Number(lead.id)
    await db.execute(sql`UPDATE leads SET trashed_at = now() WHERE id = ${leadId}`)
  }, 30000)

  afterAll(async () => {
    if (!db) return
    await db.execute(sql`DELETE FROM leads WHERE id = ${leadId}`)
    await db.execute(sql`DELETE FROM media WHERE filename = ${FILENAME}`)
  })

  it('deletes the files the lead had already dropped into the trash', async () => {
    const dropped = await insertTestMedia(db, FILENAME)
    await recordDetachments(db, { collection: 'leads', field: 'assets', id: leadId }, [dropped])
    const { eraseTrashedLead } = await import('@/lib/leads/erase-lead')

    expect(await eraseTrashedLead(payload, leadId)).toEqual({ ok: true })

    const remaining = await db.execute(sql`SELECT 1 FROM media WHERE id = ${dropped}`)
    expect(remaining.rows).toHaveLength(0)
  })
})
