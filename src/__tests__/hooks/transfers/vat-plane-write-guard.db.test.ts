import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Transaction } from '@/payload-types'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// The persisted-row half of the plane rules the hook and the collection pin in isolation. Two
// invariants, one spec because they are the same fact from both ends: the tag names the side of the
// settlement a wpłata pays, so it belongs to a wpłata od inwestora alone and it is write-once —
// a booked plane never moves, on ANY write path, while a legacy row that never had one can still be
// filled in.
// Asserting the ACTION's result would say nothing — a `success: true` sits happily on top of
// a write Payload stripped, and on top of one it let through.

vi.mock('server-only', () => ({}))
// The sheet-sync hook defers to after(), which needs a request scope and live Google credentials.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
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
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
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

    const register = await payload.create({
      collection: 'cash-registers',
      data: { name: 'vat-plane-guard-register', owner: adminId, type: 'AUXILIARY' },
      context: { skipRevalidation: true },
    })
    registerId = Number(register.id)

    investmentId = await createTestInvestment(payload, 'vat-plane-guard-investment')

    persisted.deposit = await createRow({
      description: `${MARKER} deposit`,
      type: 'INVESTOR_DEPOSIT',
      vatPlane: 'GROSS',
      netAmount: 1000,
    })
    persisted.companyFunding = await createRow({
      description: `${MARKER} company funding`,
      type: 'COMPANY_FUNDING',
      vatPlane: 'GROSS',
    })
    // A row as it was written before EX-536 existed: no plane, and therefore no netto either.
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

  it('strips a plane smuggled onto a deposit type that is not the investor one', async () => {
    expect(await persistedPlane(persisted.companyFunding!)).toBeNull()
  })

  // Positive control: without it the assertion above would also pass on a build that nulls the
  // column for every type.
  it('keeps the plane on a wpłata od inwestora', async () => {
    expect(await persistedPlane(persisted.deposit!)).toBe('GROSS')
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

  // The netto twin of the re-tag guard: once a wpłata brutto names its netto, that figure is what
  // the bilans has already billed, so an edit may not move it either.
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

  // The path every server action writes on, and the reason write-once lives in the hook: a Local
  // API write skips access control, so a fields-only guard would wave this one through. Loud here by
  // design — silence would let a caller believe the re-tag landed.
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
