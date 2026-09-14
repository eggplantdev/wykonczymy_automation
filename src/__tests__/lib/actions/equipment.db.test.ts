import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// Adding an item and saying where it went is one write or none: an item whose first event failed
// reads as „nie wiadomo gdzie" for the rest of its life, which is the register's alarm state — and
// nothing on screen tells that apart from a real gap. Asserted on the TABLE, not on the action's
// result: a success value can sit on top of a half-written pair.

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, role: 'ADMIN', name: 'T', email: 't@t.pl' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const NAME = 'EX-758 create-in-one-transaction'
const MISSING_HOLDER_ID = 2_000_000_000

describe.skipIf(!ENV_READY)(
  'createEquipmentAction writes the item and its first entry together (DB)',
  () => {
    let payload: Payload
    let db: Awaited<ReturnType<typeof getDb>>
    let warehouseId: number
    let createEquipmentAction: typeof import('@/lib/actions/equipment').createEquipmentAction

    const ITEM = {
      name: NAME,
      serialNumber: null,
      make: '',
      model: '',
      purchaseDate: null,
      warrantyUntil: null,
      purchasePrice: null,
      note: '',
      status: 'IN_USE' as const,
      occurredAt: '2026-09-01',
      investment: null,
    }

    const countRows = async () => {
      const items = await db.execute(sql`SELECT id FROM equipment WHERE name = ${NAME}`)
      const events = await db.execute(sql`
      SELECT id FROM equipment_events WHERE equipment_id IN (
        SELECT id FROM equipment WHERE name = ${NAME}
      )
    `)
      return { items: items.rows.length, events: events.rows.length }
    }

    const purge = async () => {
      await db.execute(sql`
      DELETE FROM equipment_events WHERE equipment_id IN (
        SELECT id FROM equipment WHERE name = ${NAME}
      )
    `)
      await db.execute(sql`DELETE FROM equipment WHERE name = ${NAME}`)
      await db.execute(sql`DELETE FROM warehouses WHERE name = ${NAME}`)
    }

    beforeAll(async () => {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      payload = await getPayload({ config })
      db = await getDb(payload)
      ;({ createEquipmentAction } = await import('@/lib/actions/equipment'))

      const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
      const firstUser = users.docs[0]
      if (!firstUser) throw new Error('no user in the DB to attribute the event to')
      authState.userId = Number(firstUser.id)

      await purge()
      const warehouse = await payload.create({
        collection: 'warehouses',
        data: { name: NAME },
        overrideAccess: true,
        context: { skipRevalidation: true },
      })
      warehouseId = Number(warehouse.id)
    })

    beforeEach(async () => {
      await db.execute(sql`
      DELETE FROM equipment_events WHERE equipment_id IN (
        SELECT id FROM equipment WHERE name = ${NAME}
      )
    `)
      await db.execute(sql`DELETE FROM equipment WHERE name = ${NAME}`)
    })

    afterAll(purge)

    it('persists the item and one event when the pair lands', async () => {
      const result = await createEquipmentAction({
        ...ITEM,
        holder: null,
        warehouse: warehouseId,
        serviceProvider: null,
      })

      expect(result.success).toBe(true)
      expect(await countRows()).toEqual({ items: 1, events: 1 })
    })

    it('leaves no item behind when the first entry cannot be written', async () => {
      // A holder id nobody has: the schema lets it through (it is a number), the foreign key does not
      // — which is exactly the shape of failure the transaction exists for.
      const result = await createEquipmentAction({
        ...ITEM,
        holder: MISSING_HOLDER_ID,
        warehouse: null,
        serviceProvider: null,
      })

      expect(result.success).toBe(false)
      expect(await countRows()).toEqual({ items: 0, events: 0 })
    })

    it('refuses a payload that names no place at all', async () => {
      const result = await createEquipmentAction({
        ...ITEM,
        holder: null,
        warehouse: null,
        serviceProvider: null,
      })

      expect(result.success).toBe(false)
      expect(await countRows()).toEqual({ items: 0, events: 0 })
    })
  },
)
