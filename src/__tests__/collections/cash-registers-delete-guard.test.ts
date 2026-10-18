import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// Both register FKs are ON DELETE SET NULL, so the delete this guards never errors on its own — it
// succeeds and the transaction stops naming the kasa it moved money out of.

describe.skipIf(!ENV_READY)('cash-registers beforeDelete guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  // Cleanup runs by id, never through the register: the second test deletes the kasa, and once
  // `source_register_id` is NULL `purgeFixtureUsers` can no longer see the row to remove it.
  const createdTransactionIds: number[] = []

  async function registerExists(): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM cash_registers WHERE id = ${registerId}`)
    return result.rows.length > 0
  }

  async function insertTransfer(description: string, cancelled: boolean): Promise<number> {
    const inserted = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id, cancelled)
      VALUES (${description}, 250, now(),
        'OTHER'::enum_transactions_type, 'CASH', ${registerId}, ${cancelled})
      RETURNING id
    `)
    const id = Number((inserted.rows[0] as { id: number }).id)
    createdTransactionIds.push(id)
    return id
  }

  function deleteRegister() {
    return payload.delete({
      collection: 'cash-registers',
      id: registerId,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    ;({ registerId } = await createRegisterOwner(
      payload,
      {
        name: 'Właściciel Kasy',
        email: 'registers-delete-guard@test.local',
        registerName: 'Kasa do usunięcia',
      },
      { context: { skipRevalidation: true } },
    ))
  })

  afterAll(async () => {
    for (const id of createdTransactionIds) {
      await db.execute(sql`DELETE FROM transactions WHERE id = ${id}`)
    }
    await purgeFixtureUsers(db)
  })

  it('refuses to delete a register that still has live transactions', async () => {
    const transactionId = await insertTransfer('register-guard live employee expense', false)

    await expect(deleteRegister()).rejects.toThrow(/Nie można usunąć kasy/)
    expect(await registerExists()).toBe(true)

    await db.execute(sql`DELETE FROM transactions WHERE id = ${transactionId}`)
  })
})
