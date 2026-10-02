import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'

// The purge is the one erase nobody confirms, so the assertion is on which leads keep their
// contents — and an erased tombstone, which keeps its old trash date forever, must not be re-erased
// every night.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = `EX-970 purge ${Date.now()}`

describe.skipIf(!ENV_READY)('purgeLeadTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: number
  let recent: number
  let live: number

  const erasedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT name, erased_at FROM leads WHERE id = ${id}`)
    return rows[0]
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const createLead = async (suffix: string) =>
      (
        await payload.create({
          collection: 'leads',
          data: {
            source: 'website_form',
            name: `${PREFIX} ${suffix}`,
            contactStatus: 'new',
            notifyStatus: 'sent',
            autoReplyStatus: 'skipped',
          },
          overrideAccess: true,
          context: { skipRevalidation: true },
        })
      ).id
    expired = await createLead('1')
    recent = await createLead('2')
    live = await createLead('3')
    await trashDaysAgo(db, expired, PAST_RETENTION_DAYS, 'leads')
    await trashDaysAgo(db, recent, WITHIN_RETENTION_DAYS, 'leads')
  }, 30000)

  afterAll(async () => {
    for (const id of [expired, recent, live]) {
      if (id) await db.execute(sql`DELETE FROM leads WHERE id = ${id}`)
    }
  })

  it('erases only the lead past retention, and never reselects the tombstone', async () => {
    const { purgeLeadTrash } = await import('@/lib/leads/purge-trash')
    const { selectPurgeableLeadIds } = await import('@/lib/db/lead-trash')

    await purgeLeadTrash(payload, db)

    expect(await erasedAt(expired)).toMatchObject({ name: null })
    expect((await erasedAt(expired)).erased_at).not.toBeNull()
    expect(await erasedAt(recent)).toMatchObject({ name: `${PREFIX} 2`, erased_at: null })
    expect(await erasedAt(live)).toMatchObject({ name: `${PREFIX} 3`, erased_at: null })
    expect(await selectPurgeableLeadIds(db, 30)).not.toContain(expired)
  })
})
