import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { parseVehicleFlags } from '@/lib/fleet/flags'
import { warsawToday } from '@/lib/utils/days'

// The re-tick trap: a mark already answered by an inspection still has its old day in the stored
// map, so "keep whatever is stored" would write back a day the history covers and the tick would
// silently do nothing. Driven against the REAL DB and asserted on the PERSISTED row — the action's
// success flag cannot prove which date landed.
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { setVehicleFlagsAction } = await import('@/lib/actions/fleet')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('setVehicleFlagsAction (DB)', () => {
  let payload: Payload
  let vehicleId = 0

  const storedFlags = async () =>
    parseVehicleFlags(
      (await payload.findByID({ collection: 'vehicles', id: vehicleId, depth: 0 })).flags,
    )

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    const created = await payload.create({
      collection: 'vehicles',
      data: {
        registration: `TEST-FLAGS-${Date.now()}`,
        make: 'Ford',
        model: 'Transit',
        status: 'ACTIVE',
        flags: { OIL_CHANGE: '2026-01-01' },
      },
    })
    vehicleId = Number(created.id)

    // Answers the stored 2026-01-01 mark, so it reads as retired before the re-tick.
    await payload.create({
      collection: 'vehicle-inspections',
      data: {
        vehicle: vehicleId,
        type: 'OIL_CHANGE',
        performedAt: '2026-02-01T00:00:00.000Z',
        cost: 0,
      },
    })
  })

  afterAll(async () => {
    if (!vehicleId) return
    await payload.delete({
      collection: 'vehicle-inspections',
      where: { vehicle: { equals: vehicleId } },
    })
    await payload.delete({ collection: 'vehicles', id: vehicleId })
  })

  it('re-stamps a retired mark with today instead of keeping the stale day', async () => {
    const result = await setVehicleFlagsAction(vehicleId, ['OIL_CHANGE'])
    expect(result.success).toBe(true)

    expect(await storedFlags()).toEqual({ OIL_CHANGE: warsawToday() })
  })

  it('drops what was unticked', async () => {
    await setVehicleFlagsAction(vehicleId, ['TYRES'])

    expect(await storedFlags()).toEqual({ TYRES: warsawToday() })
  })

  it('rejects a type that is not an inspection type', async () => {
    await setVehicleFlagsAction(vehicleId, ['WIPERS' as never])

    expect(await storedFlags()).toEqual({ TYRES: warsawToday() })
  })
})
