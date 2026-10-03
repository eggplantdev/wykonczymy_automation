import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { loadWarrantyRows } from '@/lib/equipment/sweep-io'

// The warranty digest reads equipment on its own, not through the listing — a trashed item must not
// keep mailing the office about a warranty nobody can see.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-916 warranty'

describe.skipIf(!ENV_READY)('warranty sweep skips a trashed item (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let equipmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
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
