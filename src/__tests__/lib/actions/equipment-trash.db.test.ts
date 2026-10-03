import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'

// The session is mocked rather than `requireAuth`, so the role gate under test is the real one.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'EX-916 akcje'

describe.skipIf(!ENV_READY)('equipment trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/equipment-trash')
  let serial = 0

  const createItem = async () => {
    const name = `${PREFIX} ${++serial}`
    const id = Number(
      (
        await payload.create({
          collection: 'equipment',
          data: { name, status: 'IN_USE' },
          overrideAccess: true,
          context: { skipRevalidation: true },
        })
      ).id,
    )
    return { id, name }
  }

  const addHandover = (equipmentId: number) =>
    payload.create({
      collection: 'equipment-events',
      data: {
        equipment: equipmentId,
        occurredAt: '2026-08-01T00:00:00.000Z',
        serviceProvider: 'Serwis',
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    } as Parameters<Payload['create']>[0])

  const trashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM equipment WHERE id = ${id}`)
    return rows[0]?.trashed_at ?? null
  }

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM equipment WHERE id = ${id}`)
    return rows.length > 0
  }

  const eventCount = async (equipmentId: number) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM equipment_events WHERE equipment_id = ${equipmentId}`,
    )
    return Number(rows[0].count)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/equipment-trash')
    await db.execute(sql`DELETE FROM equipment WHERE name LIKE ${`${PREFIX}%`}`)
  })

  beforeEach(() => {
    session.role = 'OWNER'
    revalidateCollections.mockClear()
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM equipment WHERE name LIKE ${`${PREFIX}%`}`)
  })

  it('lets a MANAGER trash, restore and delete forever an item with handovers', async () => {
    session.role = 'MANAGER'
    const { id, name } = await createItem()
    await addHandover(id)

    expect((await actions.trashEquipmentAction(id)).success).toBe(true)
    expect(await trashedAt(id)).not.toBeNull()
    expect(await eventCount(id)).toBe(1)

    expect((await actions.restoreEquipmentAction(id)).success).toBe(true)
    expect(await trashedAt(id)).toBeNull()

    expect((await actions.trashEquipmentAction(id)).success).toBe(true)
    expect((await actions.deleteEquipmentForeverAction(id, name)).success).toBe(true)
    expect(await exists(id)).toBe(false)
    expect(await eventCount(id)).toBe(0)
  })

  it('refuses a delete forever whose typed name does not match', async () => {
    const { id } = await createItem()
    await actions.trashEquipmentAction(id)

    expect((await actions.deleteEquipmentForeverAction(id, 'inna nazwa')).success).toBe(false)
    expect(await exists(id)).toBe(true)
  })

  it('refuses a delete forever of an item that is not in the trash', async () => {
    const { id, name } = await createItem()

    expect(await actions.deleteEquipmentForeverAction(id, name)).toEqual({
      success: false,
      error: 'Najpierw przenieś sprzęt do kosza.',
    })
    expect(await exists(id)).toBe(true)
  })

  it('answers a missing item as missing', async () => {
    expect(await actions.trashEquipmentAction(-1)).toEqual({
      success: false,
      error: 'Sprzęt nie istnieje.',
    })
  })

  it('refuses an EMPLOYEE every action', async () => {
    const live = await createItem()
    const trashed = await createItem()
    await actions.trashEquipmentAction(trashed.id)
    session.role = 'EMPLOYEE'

    expect((await actions.trashEquipmentAction(live.id)).success).toBe(false)
    expect((await actions.restoreEquipmentAction(trashed.id)).success).toBe(false)
    expect((await actions.deleteEquipmentForeverAction(trashed.id, trashed.name)).success).toBe(
      false,
    )
    expect(await trashedAt(live.id)).toBeNull()
    expect(await exists(trashed.id)).toBe(true)
  })

  it('expires the equipment readers, and the handovers too on a delete', async () => {
    const { id, name } = await createItem()

    await actions.trashEquipmentAction(id)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(['equipment'])

    await actions.deleteEquipmentForeverAction(id, name)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(['equipment', 'equipmentEvents'])
  })
})
