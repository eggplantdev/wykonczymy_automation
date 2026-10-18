import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { loadWarrantyRows } from '@/lib/equipment/sweep-io'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'EX-916 warranty'

describe.skipIf(!ENV_READY)('warranty sweep skips a trashed item (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let equipmentId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM equipment WHERE name = ${MARKER}`)

    const item = await payload.create({
      collection: 'equipment',
      data: { name: MARKER, status: 'IN_USE', warrantyUntil: '2026-10-15T00:00:00.000Z' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    equipmentId = Number(item.id)
  })

  afterAll(async () => {
    if (equipmentId) await db.execute(sql`DELETE FROM equipment WHERE id = ${equipmentId}`)
  })

  it('reads a live item with a warranty', async () => {
    expect((await loadWarrantyRows(payload)).map(({ id }) => id)).toContain(equipmentId)
  })

  it('leaves a trashed item out', async () => {
    await db.execute(sql`UPDATE equipment SET trashed_at = now() WHERE id = ${equipmentId}`)

    expect((await loadWarrantyRows(payload)).map(({ id }) => id)).not.toContain(equipmentId)
  })
})
