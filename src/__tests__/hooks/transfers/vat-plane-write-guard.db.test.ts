import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import type { Transaction } from '@/payload-types'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestRegister } from '@/__tests__/helpers/transfer-fixtures'

const MARKER = 'vat-plane write guard'

describe.skipIf(!ENV_READY)('the wpłata plane is write-once and deposit-only (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let adminId: number
  let admin: Parameters<Payload['update']>[0]['user']
  let registerId: number
  const persisted: Record<string, number> = {}

  async function createRow(
    data: Partial<Transaction> & Pick<Transaction, 'type' | 'description'>,
  ): Promise<number> {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        amount: 1230,
        date: '2026-08-23T09:00:00.000Z',
        paymentMethod: 'TRANSFER',
        sourceRegister: registerId,
        investment: investmentId,
        ...data,
      },
      overrideAccess: true,
      context: { skipRevalidation: true, skipSheetSync: true },
    })
    return Number(created.id)
  }

  async function persistedPlane(transactionId: number): Promise<string | null> {
    const result = await db.execute(sql`
      SELECT vat_plane FROM transactions WHERE id = ${transactionId}
    `)
    const value = result.rows[0]?.vat_plane
    return value === null || value === undefined ? null : String(value)
  }

  async function persistedNetAmount(transactionId: number): Promise<number | null> {
    const result = await db.execute(sql`
      SELECT net_amount FROM transactions WHERE id = ${transactionId}
    `)
    const value = result.rows[0]?.net_amount
    return value === null || value === undefined ? null : Number(value)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)

    // ADMIN because the re-tag attempt below runs with access control ON — a stripped field only
    // proves anything if the write itself was allowed through the collection gate.
    admin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Vat Plane Guard Admin',
        role: 'ADMIN',
        email: 'vat-plane-guard-admin@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })) as typeof admin
    adminId = Number(admin!.id)

    registerId = await createTestRegister(payload, adminId, 'vat-plane-guard-register')

    investmentId = await createTestInvestment(payload, 'vat-plane-guard-investment')

    persisted.deposit = await createRow({
      description: `${MARKER} deposit`,
      type: 'INVESTOR_DEPOSIT',
      vatPlane: 'GROSS',
      netAmount: 1000,
    })
    persisted.legacy = await createRow({
      description: `${MARKER} legacy deposit`,
      type: 'INVESTOR_DEPOSIT',
    })
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    if (registerId)
      await payload.delete({
        collection: 'cash-registers',
        id: registerId,
        context: { skipRevalidation: true },
      })
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (adminId)
      await payload.delete({
        collection: 'users',
        id: adminId,
        context: { skipRevalidation: true },
      })
  })

  it('lets a legacy wpłata that never had a plane get one, with its netto', async () => {
    await payload.update({
      collection: 'transactions',
      id: persisted.legacy!,
      data: { vatPlane: 'GROSS', netAmount: 1000 },
      user: admin,
      overrideAccess: false,
      context: { skipRevalidation: true, skipSheetSync: true },
    })

    expect(await persistedPlane(persisted.legacy!)).toBe('GROSS')
    expect(await persistedNetAmount(persisted.legacy!)).toBe(1000)
  })

  it('refuses to re-tag a booked wpłata', async () => {
    // `access.update` strips rather than throws, hence the assertion on the STORED plane.
    await payload.update({
      collection: 'transactions',
      id: persisted.deposit!,
      data: { vatPlane: 'NET' },
      user: admin,
      overrideAccess: false,
      context: { skipRevalidation: true, skipSheetSync: true },
    })

    expect(await persistedPlane(persisted.deposit!)).toBe('GROSS')
  })

  it('refuses to move the netto of a wpłata that already has one', async () => {
    await payload.update({
      collection: 'transactions',
      id: persisted.deposit!,
      data: { netAmount: 500 },
      user: admin,
      overrideAccess: false,
      context: { skipRevalidation: true, skipSheetSync: true },
    })

    expect(await persistedNetAmount(persisted.deposit!)).toBe(1000)
  })

  it('refuses a re-tag on the Local API path too, where field access never runs', async () => {
    await expect(
      payload.update({
        collection: 'transactions',
        id: persisted.deposit!,
        data: { vatPlane: 'NET' },
        context: { skipRevalidation: true, skipSheetSync: true },
      }),
    ).rejects.toThrow(/nie można zmienić/)

    expect(await persistedPlane(persisted.deposit!)).toBe('GROSS')
  })
})
