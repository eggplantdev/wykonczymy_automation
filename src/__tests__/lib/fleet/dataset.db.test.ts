import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { groupByVehicle, loadFleetDataset } from '@/lib/fleet/dataset'

// The one chokepoint for /flota, the car's own page and the reminder mail — a trashed car hidden
// here is hidden from all three, and its inspections go with it because they are grouped under it.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const REGISTRATION = 'EX915 DATASET'

describe.skipIf(!ENV_READY)('fleet dataset skips a trashed vehicle (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let vehicleId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM vehicles WHERE registration = ${REGISTRATION}`)

    const vehicle = await payload.create({
      collection: 'vehicles',
      data: { registration: REGISTRATION, make: 'Ford', model: 'Transit', status: 'ACTIVE' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    vehicleId = Number(vehicle.id)
    await payload.create({
      collection: 'vehicle-inspections',
      data: { vehicle: vehicleId, type: 'TECHNICAL', performedAt: '2026-08-01T00:00:00.000Z' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  })

  afterAll(async () => {
    if (vehicleId) await db.execute(sql`DELETE FROM vehicles WHERE id = ${vehicleId}`)
  })

  it('lists a live vehicle with its inspection', async () => {
    const grouped = groupByVehicle(await loadFleetDataset(payload))
    const ours = grouped.find(({ vehicle }) => vehicle.id === vehicleId)

    expect(ours?.events).toHaveLength(1)
  })

  it('leaves a trashed vehicle, and its inspections, out of every grouped view', async () => {
    await db.execute(sql`UPDATE vehicles SET trashed_at = now() WHERE id = ${vehicleId}`)
    const dataset = await loadFleetDataset(payload)
    const grouped = groupByVehicle(dataset)

    expect(dataset.vehicles.map(({ id }) => id)).not.toContain(vehicleId)
    expect(grouped.flatMap(({ events }) => events).map(({ vehicleId: id }) => id)).not.toContain(
      vehicleId,
    )
  })
})
