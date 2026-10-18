import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  PAST_RETENTION_DAYS,
  WITHIN_RETENTION_DAYS,
  trashDaysAgo,
} from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createRegisterOwner } from '@/__tests__/helpers/register'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'kosz-pracownikow purge'

describe.skipIf(!ENV_READY)('purgeWorkerTrash (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let expired: { worker: number; register: number }
  let recent: { worker: number; register: number }
  let pinned: { worker: number; register: number }

  const exists = async (table: 'users' | 'cash_registers', id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM ${sql.raw(table)} WHERE id = ${id}`)
    return rows.length > 0
  }

  const trashedPair = async (slug: string, days: number) => {
    const { ownerId: worker, registerId: register } = await createRegisterOwner(
      payload,
      { name: slug, email: `${slug}@test.local`, registerName: `Kasa ${slug}` },
      { context: { skipRevalidation: true } },
    )
    await trashDaysAgo(db, worker, days, 'users')
    await db.execute(sql`
      UPDATE cash_registers SET trashed_at = (SELECT trashed_at FROM users WHERE id = ${worker})
      WHERE id = ${register}
    `)
    return { worker, register }
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    expired = await trashedPair('kosz-pracownikow-purge-expired', PAST_RETENTION_DAYS)
    recent = await trashedPair('kosz-pracownikow-purge-recent', WITHIN_RETENTION_DAYS)
    pinned = await trashedPair('kosz-pracownikow-purge-pinned', PAST_RETENTION_DAYS)
    // Only raw SQL gets past the write gate — the shape a purge must still refuse to orphan.
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, worker_id)
      VALUES (${MARKER}, 50, now(), 'PAYOUT'::enum_transactions_type, 'CASH', ${pinned.worker})
    `)
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('deletes the unused worker past retention with his kasa, and nobody else', async () => {
    const { purgeWorkerTrash } = await import('@/lib/workers/purge-trash')

    const result = await purgeWorkerTrash(payload, db)

    expect(await exists('users', expired.worker)).toBe(false)
    expect(await exists('cash_registers', expired.register)).toBe(false)
    expect(await exists('users', recent.worker)).toBe(true)
    expect(await exists('cash_registers', recent.register)).toBe(true)
    expect(await exists('users', pinned.worker)).toBe(true)
    expect(await exists('cash_registers', pinned.register)).toBe(true)
    expect(result.blocked).toBeGreaterThanOrEqual(1)
  })
})
