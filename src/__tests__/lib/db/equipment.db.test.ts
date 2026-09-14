import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  loadEquipmentAtLocation,
  loadEquipmentById,
  loadEquipmentOverview,
} from '@/lib/db/equipment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// The one rule the whole module rests on: „gdzie jest" is the newest event by the DAY IT HAPPENED,
// not by the row that was typed in last. Backdating is the normal case here — a handover gets
// entered when someone gets round to it, often after a later one — so a `created_at` ordering would
// be green on every tidy fixture and wrong on real data. Asserted against a real Postgres because
// `DISTINCT ON` ordering is exactly what a JS-level fake cannot vouch for.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-758 current state'

describe.skipIf(!ENV_READY)('current equipment location (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let equipmentId: number
  let warehouseId: number
  let holderId: number

  const createEvent = (data: Record<string, unknown>) =>
    payload.create({
      collection: 'equipment-events',
      data: { equipment: equipmentId, note: MARKER, ...data },
      overrideAccess: true,
      context: { skipRevalidation: true },
    } as Parameters<Payload['create']>[0])

  const ourRow = async () =>
    (await loadEquipmentOverview(payload)).find((row) => row.id === equipmentId)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM equipment_events WHERE note = ${MARKER}`)
    await db.execute(sql`DELETE FROM equipment WHERE name = ${MARKER}`)
    await db.execute(sql`DELETE FROM warehouses WHERE name = ${MARKER}`)
    await purgeFixtureUsers(db)

    const holder = await payload.create({
      collection: 'users',
      data: {
        name: 'Equipment Current Holder',
        role: 'EMPLOYEE',
        email: 'equipment-current-holder@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    holderId = Number(holder.id)

    const warehouse = await payload.create({
      collection: 'warehouses',
      data: { name: MARKER },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    warehouseId = Number(warehouse.id)

    const equipment = await payload.create({
      collection: 'equipment',
      data: { name: MARKER, status: 'IN_USE' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    equipmentId = Number(equipment.id)

    // Written in the order that would trap a `created_at` reading: the handover to the person
    // HAPPENED later but is ENTERED first, so the warehouse row is the newest row in the table.
    await createEvent({ occurredAt: '2026-08-20T00:00:00.000Z', holder: holderId })
    await createEvent({ occurredAt: '2026-08-10T00:00:00.000Z', warehouse: warehouseId })
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM equipment_events WHERE note = ${MARKER}`)
    if (equipmentId) await db.execute(sql`DELETE FROM equipment WHERE id = ${equipmentId}`)
    if (warehouseId) await db.execute(sql`DELETE FROM warehouses WHERE id = ${warehouseId}`)
    if (holderId)
      await payload.delete({
        collection: 'users',
        id: holderId,
        overrideAccess: true,
        context: { skipRevalidation: true },
      })
  })

  it('takes the newest event by occurredAt, not by the row entered last', async () => {
    expect((await ourRow())?.location).toEqual({
      kind: 'holder',
      id: holderId,
      name: 'Equipment Current Holder',
    })
  })

  it('reports the day the item got there, not the day the row was created', async () => {
    expect((await ourRow())?.locatedAt?.slice(0, 10)).toBe('2026-08-20')
  })

  it('lists the item under the person currently holding it', async () => {
    const held = await loadEquipmentAtLocation(payload, { kind: 'holder', id: holderId })

    expect(held.map((row) => row.id)).toContain(equipmentId)
  })

  // Positive control on the same parameterised query: the superseded warehouse must NOT still
  // report the item as being on its shelf.
  it('does not list the item under the warehouse it has already left', async () => {
    const stored = await loadEquipmentAtLocation(payload, { kind: 'warehouse', id: warehouseId })

    expect(stored.map((row) => row.id)).not.toContain(equipmentId)
  })

  it('reads one item by id through the same rule as the listing', async () => {
    expect(await loadEquipmentById(payload, equipmentId)).toEqual(await ourRow())
  })

  it('has nothing to read for an id that is not in the register', async () => {
    expect(await loadEquipmentById(payload, -1)).toBeNull()
  })

  // „Kto ma sprzęt" is a question about equipment somebody still has to hand back. A sold item stays
  // in the register for its history, and the last person to hold it must not read as still holding it.
  it('leaves a retired item off the list of who is holding equipment', async () => {
    const sold = await payload.create({
      collection: 'equipment',
      data: { name: `${MARKER} sprzedany`, status: 'SOLD' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    await payload.create({
      collection: 'equipment-events',
      data: {
        equipment: Number(sold.id),
        note: MARKER,
        occurredAt: '2026-08-20T00:00:00.000Z',
        holder: holderId,
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    } as Parameters<Payload['create']>[0])

    const held = await loadEquipmentAtLocation(payload, { kind: 'holder', id: holderId })
    await db.execute(sql`DELETE FROM equipment WHERE id = ${Number(sold.id)}`)

    expect(held.map((row) => row.id)).not.toContain(Number(sold.id))
  })

  // The column carries a unique index and Postgres treats two empty strings as a collision, so
  // without the collection's normalisation the second nameplate-less item is refused outright.
  it('lets two items be saved with the serial number left blank', async () => {
    const blank = (suffix: string) =>
      payload.create({
        collection: 'equipment',
        data: { name: `${MARKER} bez tabliczki ${suffix}`, status: 'IN_USE', serialNumber: '' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      })

    const first = await blank('a')
    const second = await blank('b')
    await db.execute(
      sql`DELETE FROM equipment WHERE id IN (${Number(first.id)}, ${Number(second.id)})`,
    )

    expect(second.serialNumber ?? null).toBeNull()
  })

  it('returns an item that has never moved with no location at all', async () => {
    const fresh = await payload.create({
      collection: 'equipment',
      data: { name: `${MARKER} nietknięty`, status: 'IN_USE' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    const row = (await loadEquipmentOverview(payload)).find(
      (candidate) => candidate.id === Number(fresh.id),
    )
    await db.execute(sql`DELETE FROM equipment WHERE id = ${Number(fresh.id)}`)

    expect(row?.location).toEqual({ kind: 'unknown' })
    expect(row?.locatedAt).toBeNull()
  })
})
