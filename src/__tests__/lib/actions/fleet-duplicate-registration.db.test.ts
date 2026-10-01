import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { VehicleFormDataT } from '@/components/forms/vehicle-form/vehicle-schema'

// A trashed car keeps its plate, so a second car with that plate is refused — and the sentence must
// send the owner to the Kosz, because no listing shows the car that holds it.

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'EX915D'

describe.skipIf(!ENV_READY)('vehicle registration clash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/fleet')
  let liveId: number

  const form = (registration: string): VehicleFormDataT => ({
    registration,
    make: 'Ford',
    model: 'Transit',
    year: null,
    vin: '',
    tyres: '',
    note: '',
    exemptions: [],
    status: 'ACTIVE',
  })

  const countWith = async (registration: string) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM vehicles WHERE registration = ${registration}`,
    )
    return Number(rows[0].count)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/fleet')
    await db.execute(sql`DELETE FROM vehicles WHERE registration LIKE ${`${PREFIX}%`}`)

    const create = async (registration: string) =>
      Number(
        (
          await payload.create({
            collection: 'vehicles',
            data: { registration, make: 'Ford', model: 'Transit', status: 'ACTIVE' },
            overrideAccess: true,
            context: { skipRevalidation: true },
          })
        ).id,
      )
    liveId = await create(`${PREFIX}LIVE`)
    const trashedId = await create(`${PREFIX}KOSZ`)
    await db.execute(sql`UPDATE vehicles SET trashed_at = now() WHERE id = ${trashedId}`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM vehicles WHERE registration LIKE ${`${PREFIX}%`}`)
  })

  it('refuses a new car with a live car’s plate', async () => {
    expect(await actions.createVehicleAction(form(`${PREFIX}LIVE`))).toEqual({
      success: false,
      error: `Pojazd o rejestracji ${PREFIX}LIVE już istnieje.`,
    })
    expect(await countWith(`${PREFIX}LIVE`)).toBe(1)
  })

  it('sends the owner to the Kosz when the plate belongs to a trashed car', async () => {
    expect(await actions.createVehicleAction(form(`${PREFIX}KOSZ`))).toEqual({
      success: false,
      error: `Pojazd o rejestracji ${PREFIX}KOSZ jest w Koszu — przywróć go stamtąd.`,
    })
    expect(await countWith(`${PREFIX}KOSZ`)).toBe(1)
  })

  it('refuses an edit that takes another car’s plate', async () => {
    const result = await actions.updateVehicleAction(liveId, form(`${PREFIX}KOSZ`))

    expect(result).toEqual({
      success: false,
      error: `Pojazd o rejestracji ${PREFIX}KOSZ jest w Koszu — przywróć go stamtąd.`,
    })
    expect(await countWith(`${PREFIX}LIVE`)).toBe(1)
  })

  it('lets a car be saved with its own plate', async () => {
    expect((await actions.updateVehicleAction(liveId, form(`${PREFIX}LIVE`))).success).toBe(true)
  })
})
