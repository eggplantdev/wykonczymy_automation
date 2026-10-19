import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  countUnreadFleetDeadlines,
  countUnreadLeads,
  countUnreadWarranties,
} from '@/__tests__/helpers/stream-counts'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { storeLead, type StoreLeadInputT } from '@/lib/leads/store-lead'
import { warsawToday } from '@/lib/utils/days'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestEquipment, createTestVehicle } from '@/__tests__/helpers/fleet-db'

// Asserted as a difference against the shared test DB, whose dump carries badges of its own.

const MARKER = 'EX-915 badge'
const REGISTRATION = 'EX915 BADGE'
// No `notification_reads` row exists for it, so both counters read from the stream's epoch.
const NEVER_LOOKED = -1

const inDays = (days: number) => {
  const date = new Date(`${warsawToday()}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

describe.skipIf(!ENV_READY)('nav badges skip a trashed row (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let vehicleId: number
  let equipmentId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM vehicles WHERE registration = ${REGISTRATION}`)
    await db.execute(sql`DELETE FROM equipment WHERE name = ${MARKER}`)

    vehicleId = await createTestVehicle(payload, REGISTRATION)
    await payload.create({
      collection: 'vehicle-inspections',
      data: {
        vehicle: vehicleId,
        type: 'TECHNICAL',
        performedAt: inDays(-360),
        nextDueAt: inDays(5),
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })

    equipmentId = await createTestEquipment(payload, MARKER, { warrantyUntil: inDays(10) })
  })

  afterAll(async () => {
    if (vehicleId) await db.execute(sql`DELETE FROM vehicles WHERE id = ${vehicleId}`)
    if (equipmentId) await db.execute(sql`DELETE FROM equipment WHERE id = ${equipmentId}`)
  })

  it('stops counting a trashed vehicle’s due inspection', async () => {
    const today = warsawToday()
    const live = await countUnreadFleetDeadlines(payload, NEVER_LOOKED, today)
    await db.execute(sql`UPDATE vehicles SET trashed_at = now() WHERE id = ${vehicleId}`)
    const trashed = await countUnreadFleetDeadlines(payload, NEVER_LOOKED, today)

    expect(live - trashed).toBe(1)
  })

  it('stops counting a trashed item’s expiring warranty', async () => {
    const today = warsawToday()
    const live = await countUnreadWarranties(payload, NEVER_LOOKED, today)
    await db.execute(sql`UPDATE equipment SET trashed_at = now() WHERE id = ${equipmentId}`)
    const trashed = await countUnreadWarranties(payload, NEVER_LOOKED, today)

    expect(live - trashed).toBe(1)
  })
})

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
    // Payload stamps `created_at` from the host clock in ms; the cursor uses Postgres `now()`.
    await (
      await getDb(payload)
    ).execute(
      sql`UPDATE leads SET created_at = now() WHERE id IN (${lead1.lead.id}, ${lead2.lead.id})`,
    )

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
