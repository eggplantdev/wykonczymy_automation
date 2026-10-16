import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { parseVehicleExemptions } from '@/lib/fleet/exemptions'
import { parseVehicleFlags } from '@/lib/fleet/flags'
import type { VehicleFormDataT } from '@/components/forms/vehicle-form/vehicle-schema'

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { updateVehicleAction } = await import('@/lib/actions/fleet')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('updateVehicleAction (DB)', () => {
  let payload: Payload
  let vehicleId = 0
  let registration = ''

  const stored = async () => payload.findByID({ collection: 'vehicles', id: vehicleId, depth: 0 })

  const edit = (overrides: Partial<VehicleFormDataT> = {}): VehicleFormDataT => ({
    registration,
    make: 'Ford',
    model: 'Transit',
    year: 2019,
    vin: 'VIN123',
    tyres: '',
    note: '',
    exemptions: [],
    status: 'ACTIVE',
    ...overrides,
  })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    registration = `TEST-EDIT-${Date.now()}`
    const created = await payload.create({
      collection: 'vehicles',
      data: {
        registration,
        make: 'Ford',
        model: 'Transit',
        year: 2019,
        vin: 'VIN123',
        status: 'ACTIVE',
        flags: { OIL_CHANGE: '2026-01-01' },
      },
    })
    vehicleId = Number(created.id)
  })

  afterAll(async () => {
    if (!vehicleId) return
    await payload.delete({ collection: 'vehicles', id: vehicleId })
  })

  it('retires an active vehicle', async () => {
    const result = await updateVehicleAction(vehicleId, edit({ status: 'RETIRED' }))
    expect(result.success).toBe(true)

    expect((await stored()).status).toBe('RETIRED')
  })

  it('leaves the „do wymiany" marks alone — the form does not carry them', async () => {
    await updateVehicleAction(vehicleId, edit({ make: 'Renault' }))

    const row = await stored()
    expect(row.make).toBe('Renault')
    expect(parseVehicleFlags(row.flags)).toEqual({ OIL_CHANGE: '2026-01-01' })
  })

  it('clears „Rocznik" when the field is emptied', async () => {
    const result = await updateVehicleAction(vehicleId, edit({ year: null }))
    expect(result.success).toBe(true)

    expect((await stored()).year).toBeNull()
  })

  it('round-trips the „nie dotyczy" exemptions, including back to none', async () => {
    await updateVehicleAction(vehicleId, edit({ exemptions: ['TECHNICAL'] }))
    expect(parseVehicleExemptions((await stored()).exemptions)).toEqual(['TECHNICAL'])

    await updateVehicleAction(vehicleId, edit({ exemptions: [] }))
    expect(parseVehicleExemptions((await stored()).exemptions)).toEqual([])
  })

  it('writes nothing when the payload fails validation', async () => {
    const result = await updateVehicleAction(vehicleId, edit({ registration: '' }))
    expect(result.success).toBe(false)

    expect((await stored()).registration).toBe(registration)
  })
})
