import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { countUnreadFleetDeadlines, countUnreadWarranties } from '@/lib/db/notifications'
import { warsawToday } from '@/lib/utils/days'
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
