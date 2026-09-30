import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// The purge is the one delete nobody confirms, so the assertion is on which kasy survive — a count
// in the result would read the same over a purge that deleted the wrong one.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('purgeCashRegisterTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: number
  let recent: number
  let pinned: number

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM cash_registers WHERE id = ${id}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const ownerId = Number(
      (
        await payload.create({
          collection: 'users',
          data: {
            name: 'Kosz Kas Purge',
            role: 'EMPLOYEE',
            email: 'kosz-kas-purge@test.local',
            password: 'test-password-123',
          },
          context: { skipRevalidation: true },
        })
      ).id,
    )
    const createRegister = async (name: string) =>
      Number(
        (
          await payload.create({
            collection: 'cash-registers',
            data: { name, type: 'AUXILIARY', owner: ownerId },
            context: { skipRevalidation: true },
          })
        ).id,
      )
    expired = await createRegister('Kasa do wyczyszczenia')
    recent = await createRegister('Kasa w okresie')
    pinned = await createRegister('Kasa z transakcją po koszu')
    await trashDaysAgo(db, expired, PAST_RETENTION_DAYS, 'cash_registers')
    await trashDaysAgo(db, recent, WITHIN_RETENTION_DAYS, 'cash_registers')
    await trashDaysAgo(db, pinned, PAST_RETENTION_DAYS, 'cash_registers')
    // Only raw SQL gets past the write gate — the shape a purge must still refuse to orphan.
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES ('kosz-kas purge', 50, now(), 'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH', ${pinned})
    `)
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('deletes only the unused kasa past retention', async () => {
    const { purgeCashRegisterTrash } = await import('@/lib/cash-registers/purge-trash')

    const result = await purgeCashRegisterTrash(payload, db)

    expect(await exists(expired)).toBe(false)
    expect(await exists(recent)).toBe(true)
    expect(await exists(pinned)).toBe(true)
    expect(result.blocked).toBeGreaterThanOrEqual(1)
  })
})
