import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'

// storeLead's collection hook calls revalidateTag, which throws outside a Next request
// context. Stub it — cache invalidation is not under test here.
vi.mock('next/cache', () => ({ revalidateTag: () => {}, updateTag: () => {} }))

import { storeLead, type StoreLeadInputT } from '@/lib/leads/store-lead'
import { countUnreadLeads, markLeadsSeen } from '@/lib/db/notifications'
import { getDb } from '@/lib/db/sum-transfers'

// Integration tests against the Payload Local API + local Postgres. Skips cleanly with
// no DB, FAILS if env is set but the DB is unreachable — same gate as store-lead.db.test.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const runTag = `test-notif-${Date.now()}`

const makeInput = (externalId: string): StoreLeadInputT => ({
  source: 'facebook_lead_ads',
  externalId,
  email: 'anna.nowak@example.com',
  name: 'Anna Nowak',
  phone: '+48500600700',
  rawData: [{ name: 'adres_e-mail', values: ['anna.nowak@example.com'] }],
  formId: '899352536400611',
  submittedAt: '2026-07-05T18:48:40.000Z',
})

describe.skipIf(!ENV_READY)('countUnreadLeads + markLeadsSeen (DB)', () => {
  let payload: Payload
  let userId: number
  const createdLeadIds: number[] = []

  const clearCursor = async () => {
    const db = await getDb(payload)
    await db.execute(
      sql`DELETE FROM notification_reads WHERE user_id = ${userId} AND stream = 'leads'`,
    )
  }

  beforeAll(async () => {
    process.env.LEADS_NOTIFY_EMAIL ??= 'inbox@example.com'
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    if (users.docs.length === 0) throw new Error('no user in local DB to attach a read cursor to')
    userId = users.docs[0].id
  })

  afterAll(async () => {
    await clearCursor()
    for (const id of createdLeadIds) {
      await payload.delete({ collection: 'leads', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('counts leads created after the cursor, and advancing the cursor clears them', async () => {
    // Cursor first, then leads → the leads are unambiguously newer than seen_at.
    await markLeadsSeen(payload, userId)

    const lead1 = await storeLead(payload, makeInput(`${runTag}-a`))
    const lead2 = await storeLead(payload, makeInput(`${runTag}-b`))
    createdLeadIds.push(lead1.lead.id, lead2.lead.id)

    // Both leads landed after the cursor.
    expect(await countUnreadLeads(payload, userId)).toBe(2)

    // Advancing the cursor past them drops the count to 0 — and re-running is idempotent.
    await markLeadsSeen(payload, userId)
    await markLeadsSeen(payload, userId)
    expect(await countUnreadLeads(payload, userId)).toBe(0)
  })

  it('with no cursor row, falls back to the epoch and still counts a fresh lead', async () => {
    await clearCursor()

    const before = await countUnreadLeads(payload, userId)
    const extra = await storeLead(payload, makeInput(`${runTag}-d`))
    createdLeadIds.push(extra.lead.id)

    // The epoch (COALESCE fallback) is before "now", so a just-created lead increments.
    expect(await countUnreadLeads(payload, userId)).toBe(before + 1)
  })
})
