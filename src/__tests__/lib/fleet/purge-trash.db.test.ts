import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'

// The purge is the one delete nobody confirms, so the assertion is on which cars survive — a count
// in the result would read the same over a purge that deleted the wrong one.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'EX915 P'

describe.skipIf(!ENV_READY)('purgeVehicleTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: number
  let recent: number
  let live: number

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM vehicles WHERE id = ${id}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await db.execute(sql`DELETE FROM vehicles WHERE registration LIKE ${`${PREFIX}%`}`)

    const createVehicle = async (suffix: string) =>
      Number(
        (
          await payload.create({
            collection: 'vehicles',
            data: {
              registration: `${PREFIX}${suffix}`,
              make: 'Ford',
              model: 'Transit',
              status: 'ACTIVE',
            },
            overrideAccess: true,
            context: { skipRevalidation: true },
          })
        ).id,
      )
    expired = await createVehicle('1')
    recent = await createVehicle('2')
    live = await createVehicle('3')
    await payload.create({
      collection: 'vehicle-inspections',
      data: { vehicle: expired, type: 'TECHNICAL', performedAt: '2026-08-01T00:00:00.000Z' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    await trashDaysAgo(db, expired, PAST_RETENTION_DAYS, 'vehicles')
    await trashDaysAgo(db, recent, WITHIN_RETENTION_DAYS, 'vehicles')
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM vehicles WHERE registration LIKE ${`${PREFIX}%`}`)
  })

  it('deletes only the car past retention, inspections and all', async () => {
    const { purgeVehicleTrash } = await import('@/lib/fleet/purge-trash')

    await purgeVehicleTrash(payload, db)
    const { rows } = await db.execute(
      sql`SELECT 1 FROM vehicle_inspections WHERE vehicle_id = ${expired}`,
    )

    expect(await exists(expired)).toBe(false)
    expect(rows).toHaveLength(0)
    expect(await exists(recent)).toBe(true)
    expect(await exists(live)).toBe(true)
  })
})
