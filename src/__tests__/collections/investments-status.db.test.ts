import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { INVESTMENT_STATUSES } from '@/lib/constants/investment-status'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// No type spans the collection's select options and the Postgres enum — a status the form offers but
// no migration added passes typecheck and fails only on save.

const MARKER = 'investment-status-db'

describe.skipIf(!ENV_READY)('investment status values (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const createdIds: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %`}`)
  })

  afterAll(async () => {
    for (const id of createdIds) await deleteTestInvestment(payload, id)
  })

  it.each(INVESTMENT_STATUSES)('stores a %s investment', async (status) => {
    const id = await createTestInvestment(payload, `${MARKER} ${status}`, { status })
    createdIds.push(id)

    const result = await db.execute(sql`SELECT status FROM investments WHERE id = ${id}`)
    expect(result.rows[0]?.status).toBe(status)
  })

  it('stores a new investment without a status as a quote', async () => {
    const created = await payload.create({
      collection: 'investments',
      // The generated create type demands `status` — omitting it is the whole point here.
      data: {
        name: `${MARKER} default`,
        settlementMode: SETTLEMENT_MODE_DEFAULT,
      } as RequiredDataFromCollectionSlug<'investments'>,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    createdIds.push(Number(created.id))

    const result = await db.execute(sql`SELECT status FROM investments WHERE id = ${created.id}`)
    expect(result.rows[0]?.status).toBe('quote')
  })
})
