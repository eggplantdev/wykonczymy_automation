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
const PREFIX = 'EX915 A'

describe.skipIf(!ENV_READY)('vehicle trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/vehicle-trash')
  let serial = 0

  const createVehicle = async (status: 'ACTIVE' | 'RETIRED' = 'ACTIVE') => {
    const registration = `${PREFIX}${++serial}`
    const id = Number(
      (
        await payload.create({
          collection: 'vehicles',
          data: { registration, make: 'Ford', model: 'Transit', status },
          overrideAccess: true,
          context: { skipRevalidation: true },
        })
      ).id,
    )
    return { id, registration }
  }

  const addInspection = (vehicleId: number) =>
    payload.create({
      collection: 'vehicle-inspections',
      data: { vehicle: vehicleId, type: 'TECHNICAL', performedAt: '2026-08-01T00:00:00.000Z' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })

  const trashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM vehicles WHERE id = ${id}`)
    return rows[0]?.trashed_at ?? null
  }

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM vehicles WHERE id = ${id}`)
    return rows.length > 0
  }

  const inspectionCount = async (vehicleId: number) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM vehicle_inspections WHERE vehicle_id = ${vehicleId}`,
    )
    return Number(rows[0].count)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/vehicle-trash')
    await db.execute(sql`DELETE FROM vehicles WHERE registration LIKE ${`${PREFIX}%`}`)
  })

  beforeEach(() => {
    session.role = 'OWNER'
    revalidateCollections.mockClear()
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM vehicles WHERE registration LIKE ${`${PREFIX}%`}`)
  })

  it('lets a MANAGER trash, restore and delete forever an ACTIVE car with inspections', async () => {
    session.role = 'MANAGER'
    const { id, registration } = await createVehicle()
    await addInspection(id)

    expect((await actions.trashVehicleAction(id)).success).toBe(true)
    expect(await trashedAt(id)).not.toBeNull()
    expect(await inspectionCount(id)).toBe(1)

    expect((await actions.restoreVehicleAction(id)).success).toBe(true)
    expect(await trashedAt(id)).toBeNull()

    expect((await actions.trashVehicleAction(id)).success).toBe(true)
    expect((await actions.deleteVehicleForeverAction(id, registration)).success).toBe(true)
    expect(await exists(id)).toBe(false)
    expect(await inspectionCount(id)).toBe(0)
  })

  it('treats trashing an already-trashed car as done, keeping its first date', async () => {
    const { id } = await createVehicle()
    await actions.trashVehicleAction(id)
    const first = await trashedAt(id)

    expect((await actions.trashVehicleAction(id)).success).toBe(true)
    expect(await trashedAt(id)).toEqual(first)
  })

  it('refuses a delete forever whose typed registration does not match', async () => {
    const { id } = await createVehicle()
    await actions.trashVehicleAction(id)

    expect((await actions.deleteVehicleForeverAction(id, 'XX 00000')).success).toBe(false)
    expect(await exists(id)).toBe(true)
  })

  it('refuses a delete forever of a car that is not in the trash', async () => {
    const { id, registration } = await createVehicle()

    expect(await actions.deleteVehicleForeverAction(id, registration)).toEqual({
      success: false,
      error: 'Najpierw przenieś pojazd do kosza.',
    })
    expect(await exists(id)).toBe(true)
  })

  it('answers a missing car as missing', async () => {
    expect(await actions.trashVehicleAction(-1)).toEqual({
      success: false,
      error: 'Pojazd nie istnieje.',
    })
  })

  it('refuses an EMPLOYEE every action', async () => {
    const live = await createVehicle()
    const trashed = await createVehicle()
    await actions.trashVehicleAction(trashed.id)
    session.role = 'EMPLOYEE'

    expect((await actions.trashVehicleAction(live.id)).success).toBe(false)
    expect((await actions.restoreVehicleAction(trashed.id)).success).toBe(false)
    expect(
      (await actions.deleteVehicleForeverAction(trashed.id, trashed.registration)).success,
    ).toBe(false)
    expect(await trashedAt(live.id)).toBeNull()
    expect(await exists(trashed.id)).toBe(true)
  })

  it('expires the fleet readers, and the inspections too on a delete', async () => {
    const { id, registration } = await createVehicle()

    await actions.trashVehicleAction(id)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(['vehicles'])

    await actions.deleteVehicleForeverAction(id, registration)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(['vehicles', 'vehicleInspections'])
  })
})
