import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createRegisterOwner, createTestRegister } from '@/__tests__/helpers/transfer-fixtures'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser } from '@/__tests__/helpers/user'

describe.skipIf(!ENV_READY)('purgeCashRegisterTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: number
  let recent: number
  let pinned: number
  let withTrashedOwner: number

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM cash_registers WHERE id = ${id}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const ownerId = await createTestUser(payload, {
      name: 'Kosz Kas Purge',
      email: 'kosz-kas-purge@test.local',
    })
    expired = await createTestRegister(payload, ownerId, 'Kasa do wyczyszczenia')
    recent = await createTestRegister(payload, ownerId, 'Kasa w okresie')
    pinned = await createTestRegister(payload, ownerId, 'Kasa z transakcją po koszu')
    await trashDaysAgo(db, expired, PAST_RETENTION_DAYS, 'cash_registers')
    await trashDaysAgo(db, recent, WITHIN_RETENTION_DAYS, 'cash_registers')
    await trashDaysAgo(db, pinned, PAST_RETENTION_DAYS, 'cash_registers')
    const { ownerId: trashedOwnerId, registerId } = await createRegisterOwner(
      payload,
      {
        name: 'Kosz Kas Purge Właściciel w koszu',
        email: 'kosz-kas-purge-trashed-owner@test.local',
        registerName: 'Kasa pracownika w koszu',
      },
      { context: { skipRevalidation: true } },
    )
    withTrashedOwner = registerId
    await trashDaysAgo(db, withTrashedOwner, PAST_RETENTION_DAYS, 'cash_registers')
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${trashedOwnerId}`)
    // Only raw SQL gets past the write gate — the shape a purge must still refuse to orphan.
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES ('kosz-kas purge', 50, now(), 'OTHER'::enum_transactions_type, 'CASH', ${pinned})
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
    expect(await exists(withTrashedOwner)).toBe(true)
    expect(result.blocked).toBeGreaterThanOrEqual(1)
  })
})
