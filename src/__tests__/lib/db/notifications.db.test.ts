import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { countUnreadFleetDeadlines, countUnreadWarranties } from '@/lib/db/notifications'
import { warsawToday } from '@/lib/utils/days'

// The two badges are the readers a trashed row is most likely to slip past: they are raw SQL beside
// the listings, not through them, so hiding a row from the page proves nothing about the nav dot.
// Asserted as a difference against the shared test DB, whose dump carries badges of its own.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
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
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM vehicles WHERE registration = ${REGISTRATION}`)
    await db.execute(sql`DELETE FROM equipment WHERE name = ${MARKER}`)

    const vehicle = await payload.create({
      collection: 'vehicles',
      data: { registration: REGISTRATION, make: 'Ford', model: 'Transit', status: 'ACTIVE' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    vehicleId = Number(vehicle.id)
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

    const item = await payload.create({
      collection: 'equipment',
      data: { name: MARKER, status: 'IN_USE', warrantyUntil: inDays(10) },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    equipmentId = Number(item.id)
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
