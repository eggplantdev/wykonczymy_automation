import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestEquipment } from '@/__tests__/helpers/fleet-db'

// The purge is the one delete nobody confirms, so the assertion is on which items survive — a count
// in the result would read the same over a purge that deleted the wrong one.

const PREFIX = 'EX-916 purge'

describe.skipIf(!ENV_READY)('purgeEquipmentTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: number
  let recent: number
  let live: number

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM equipment WHERE id = ${id}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await db.execute(sql`DELETE FROM equipment WHERE name LIKE ${`${PREFIX}%`}`)

    const createItem = (suffix: string) => createTestEquipment(payload, `${PREFIX} ${suffix}`)
    expired = await createItem('po terminie')
    recent = await createItem('w okresie')
    live = await createItem('żywy')
    await payload.create({
      collection: 'equipment-events',
      data: {
        equipment: expired,
        occurredAt: '2026-08-01T00:00:00.000Z',
        serviceProvider: 'Serwis',
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    } as Parameters<Payload['create']>[0])
    await trashDaysAgo(db, expired, PAST_RETENTION_DAYS, 'equipment')
    await trashDaysAgo(db, recent, WITHIN_RETENTION_DAYS, 'equipment')
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM equipment WHERE name LIKE ${`${PREFIX}%`}`)
  })

  it('deletes only the item past retention, handovers and all', async () => {
    const { purgeEquipmentTrash } = await import('@/lib/equipment/purge-trash')

    await purgeEquipmentTrash(payload, db)
    const { rows } = await db.execute(
      sql`SELECT 1 FROM equipment_events WHERE equipment_id = ${expired}`,
    )

    expect(await exists(expired)).toBe(false)
    expect(rows).toHaveLength(0)
    expect(await exists(recent)).toBe(true)
    expect(await exists(live)).toBe(true)
  })
})
