import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { EquipmentFormDataT } from '@/components/forms/equipment-form/equipment-schema'

// A trashed item keeps its serial, so a second item with that serial is refused — and the sentence
// must send the owner to the Kosz, because no listing shows the item that holds it.

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, role: 'OWNER', name: 'T', email: 't@t.pl' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'EX-916 numer'

describe.skipIf(!ENV_READY)('equipment serial clash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/equipment')
  let warehouseId: number
  let liveId: number

  const ITEM: EquipmentFormDataT = {
    name: `${PREFIX} nowy`,
    serialNumber: null,
    make: '',
    model: '',
    purchaseDate: null,
    warrantyUntil: null,
    purchasePrice: null,
    note: '',
    status: 'IN_USE',
  }

  const add = (serialNumber: string | null) =>
    actions.createEquipmentAction({
      ...ITEM,
      serialNumber,
      occurredAt: '2026-09-01',
      holder: null,
      warehouse: warehouseId,
      serviceProvider: null,
      investment: null,
    })

  const countWith = async (serial: string) => {
    const { rows } = await db.execute(
      sql`SELECT COUNT(*) AS count FROM equipment WHERE serial_number = ${serial}`,
    )
    return Number(rows[0].count)
  }

  const purge = async () => {
    await db.execute(sql`DELETE FROM equipment WHERE name LIKE ${`${PREFIX}%`}`)
    await db.execute(sql`DELETE FROM warehouses WHERE name = ${PREFIX}`)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/equipment')
    await purge()

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the event to')
    authState.userId = Number(firstUser.id)

    warehouseId = Number(
      (
        await payload.create({
          collection: 'warehouses',
          data: { name: PREFIX },
          overrideAccess: true,
          context: { skipRevalidation: true },
        })
      ).id,
    )
    const create = async (suffix: string) =>
      Number(
        (
          await payload.create({
            collection: 'equipment',
            data: {
              name: `${PREFIX} ${suffix}`,
              serialNumber: `${PREFIX}-${suffix}`,
              status: 'IN_USE',
            },
            overrideAccess: true,
            context: { skipRevalidation: true },
          })
        ).id,
      )
    liveId = await create('LIVE')
    const trashedId = await create('KOSZ')
    await db.execute(sql`UPDATE equipment SET trashed_at = now() WHERE id = ${trashedId}`)
  })

  afterAll(purge)

  it('refuses a new item with a live item’s serial', async () => {
    expect(await add(`${PREFIX}-LIVE`)).toEqual({
      success: false,
      error: `Sprzęt o numerze seryjnym ${PREFIX}-LIVE już istnieje.`,
    })
    expect(await countWith(`${PREFIX}-LIVE`)).toBe(1)
  })

  it('sends the owner to the Kosz when the serial belongs to a trashed item', async () => {
    expect(await add(`${PREFIX}-KOSZ`)).toEqual({
      success: false,
      error: `Sprzęt o numerze seryjnym ${PREFIX}-KOSZ jest w Koszu — przywróć go stamtąd.`,
    })
  })

  it('refuses an edit that takes another item’s serial', async () => {
    const result = await actions.updateEquipmentAction(liveId, {
      ...ITEM,
      name: `${PREFIX} LIVE`,
      serialNumber: `${PREFIX}-KOSZ`,
    })

    expect(result.success).toBe(false)
    expect(await countWith(`${PREFIX}-LIVE`)).toBe(1)
  })

  it('lets an item be saved with its own serial', async () => {
    const result = await actions.updateEquipmentAction(liveId, {
      ...ITEM,
      name: `${PREFIX} LIVE`,
      serialNumber: `${PREFIX}-LIVE`,
    })

    expect(result.success).toBe(true)
  })

  it('lets two items be added with the serial left blank', async () => {
    expect((await add(null)).success).toBe(true)
    expect((await add(null)).success).toBe(true)
  })
})
