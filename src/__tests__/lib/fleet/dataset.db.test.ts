import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { groupByVehicle, loadFleetDataset } from '@/lib/fleet/dataset'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestInspection, createTestVehicle } from '@/__tests__/helpers/fleet-db'

const REGISTRATION = 'EX915 DATASET'

describe.skipIf(!ENV_READY)('fleet dataset skips a trashed vehicle (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let vehicleId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM vehicles WHERE registration = ${REGISTRATION}`)

    vehicleId = await createTestVehicle(payload, REGISTRATION)
    await createTestInspection(payload, vehicleId, '2026-08-01T00:00:00.000Z')
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
