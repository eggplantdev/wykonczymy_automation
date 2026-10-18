import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'

import { storeLead, type StoreLeadInputT } from '@/lib/leads/store-lead'
import { STREAMS, countUnreadLeads, markSeen } from '@/lib/db/notifications'
import { getDb } from '@/lib/db/get-db'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

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

describe.skipIf(!ENV_READY)('countUnreadLeads + markSeen (DB)', () => {
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
    payload = await bootTestPayload()

    userId = await firstUserId(payload)
  })

  afterAll(async () => {
    await clearCursor()
    for (const id of createdLeadIds) {
      await payload.delete({ collection: 'leads', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('counts leads created after the cursor, and advancing the cursor clears them', async () => {
    await markSeen(payload, userId, STREAMS.leads)

    const lead1 = await storeLead(payload, makeInput(`${runTag}-a`))
    const lead2 = await storeLead(payload, makeInput(`${runTag}-b`))
    createdLeadIds.push(lead1.lead.id, lead2.lead.id)

    expect(await countUnreadLeads(payload, userId)).toBe(2)

    await markSeen(payload, userId, STREAMS.leads)
    await markSeen(payload, userId, STREAMS.leads)
    expect(await countUnreadLeads(payload, userId)).toBe(0)
  })

  it('with no cursor row, falls back to the epoch and still counts a fresh lead', async () => {
    await clearCursor()

    const before = await countUnreadLeads(payload, userId)
    const extra = await storeLead(payload, makeInput(`${runTag}-d`))
    createdLeadIds.push(extra.lead.id)

    expect(await countUnreadLeads(payload, userId)).toBe(before + 1)
  })
})
